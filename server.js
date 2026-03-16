// 这是正确的 server.js (集成智谱 GLM-4-Flash，修复全局崩溃 Bug 版)
const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

// =========================================================================
// 环境变量读取
// =========================================================================
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY; 

// 💡 核心修复 1：移除 process.exit(1)，改为只打印警告，绝不阻塞服务器启动！
if (!ZHIPU_API_KEY) {
    console.warn('⚠️ 警告：ZHIPU_API_KEY 环境变量未设置！AI 摘要功能将自动降级为默认文案，【不影响】基础的音频提取功能。');
}

app.use(express.json());

// =========================================================================
// 升级后的 extractM4a 接口 (保持不变)
// =========================================================================
app.post('/api/extractM4a', async (req, res) => {
    const { episodeUrl } = req.body;

    if (!episodeUrl || !episodeUrl.startsWith('https://www.xiaoyuzhoufm.com/episode/')) {
        return res.json({
            success: false,
            errorCode: 'INVALID_LINK',
            error: '链接格式不正确，请输入有效的小宇宙播客单集链接。',
        });
    }

    console.log(`[服务器] 开始处理链接: ${episodeUrl}`);

    try {
        const response = await axios.get(episodeUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        const htmlText = response.data;

        const m4aRegex = /(https:\/\/media\.xyzcdn\.net\/[^\s"']+\.m4a)/;
        const m4aMatch = htmlText.match(m4aRegex);
        const m4aUrl = m4aMatch ? m4aMatch[0] : null;

        let podcastTitle = '未知播客标题';
        const titleRegex = /<title>(.*?)<\/title>/;
        const titleMatch = htmlText.match(titleRegex);
        if (titleMatch && titleMatch[1]) {
            podcastTitle = titleMatch[1].replace(/\s*\|\s*小宇宙/, '').trim();
        }

        let cover = null;
        const coverRegex = /<meta\s+property="og:image"\s+content="([^"]+)"/;
        const coverMatch = htmlText.match(coverRegex);
        if (coverMatch && coverMatch[1]) {
            cover = coverMatch[1];
        }

        let shownote = '';
        try {
            const jsonLdRegex = /<script name="schema:podcast-show" type="application\/ld\+json">(.*?)<\/script>/s;
            const jsonLdMatch = htmlText.match(jsonLdRegex);
            if (jsonLdMatch && jsonLdMatch[1]) {
                const jsonLd = JSON.parse(jsonLdMatch[1]);
                if (jsonLd.description) {
                    shownote = jsonLd.description;
                }
            }
            if (!shownote) {
                const metaRegex = /<meta\s+(?:property="og:description"\s+name="description"|name="description"\s+property="og:description")\s+content="([^"]+)"/;
                const metaMatch = htmlText.match(metaRegex);
                if (metaMatch && metaMatch[1]) {
                    shownote = metaMatch[1];
                }
            }
        } catch (e) {
            console.error('[服务器] shownote 提取或解析失败:', e.message);
        }

        let podcastName = null;
        const siteNameRegex = /<meta\s+property="og:site_name"\s+content="([^"]+)"/;
        const siteNameMatch = htmlText.match(siteNameRegex);
        if (siteNameMatch && siteNameMatch[1]) {
            podcastName = siteNameMatch[1];
        }

        if (m4aUrl) {
            console.log(`[服务器] 成功提取到链接: ${m4aUrl}`);
            return res.json({
                success: true,
                m4aUrl,
                title: podcastTitle,
                cover,
                shownote,
                podcastName
            });
        } else {
            console.log('[服务器] 未在页面中找到 m4a 链接');
            return res.json({
                success: false,
                errorCode: 'PARSE_FAILED',
                error: '解析服务暂时不可用，请稍后或反馈问题。',
            });
        }
    } catch (error) {
        console.error('[服务器] 抓取或解析时出错:', error.message);
        let errorMessage = '提取失败，可能是网络问题或链接已失效。';
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage = '网络不稳定，请求超时了，请重试。';
        }
        return res.json({
            success: false,
            errorCode: 'NETWORK_ERROR',
            error: errorMessage,
        });
    }
});

// =========================================================================
// getHighlights 接口（调用智谱 GLM-4-Flash 生成摘要+金句+标签）
// =========================================================================
app.post('/api/getHighlights', async (req, res) => {
    const { title, shownote } = req.body;

    if (!shownote) {
        return res.json({
            success: false,
            error: '缺少节目简介（shownote），无法生成摘要。',
        });
    }

    // 💡 核心修复 2：如果压根没配 Key，直接光速返回兜底文案，不去请求智谱 API
    if (!ZHIPU_API_KEY) {
        console.log('[服务器] 检测到未配置 ZHIPU_API_KEY，触发服务降级，直接返回默认金句。');
        return res.json({
            success: true,
            highlights: {
                quote: "这是一句直击灵魂的播客金句，等待你的倾听。", 
                summary: "AI 摘要服务暂未配置，但精彩内容仍在链接中。",
                tags: ["摘星译", "播客推荐"]
            }
        });
    }

    const prompt = `你是一个专业的播客文案编辑。请根据以下播客内容，提取并生成以下三项信息：
1. 一句最吸引人的核心金句（不要太长）
2. 三行以内的精炼摘要（概括核心内容）
3. 3~5 个关键词标签

标题: ${title || '未知标题'}
简介: ${shownote}

【重要要求】
必须严格输出合法的 JSON 格式，不要包含任何额外的说明文字、前言或 Markdown 标记。JSON 格式如下：
{
  "quote": "金句内容",
  "summary": "摘要内容",
  "tags": ["标签1", "标签2", "标签3"]
}`;

    const apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

    try {
        const response = await axios.post(
            apiUrl,
            {
                model: "GLM-4-Flash-250414", 
                messages: [
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                top_p: 0.7
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ZHIPU_API_KEY}`
                },
                timeout: 20000 
            }
        );

        const textOutput = response.data?.choices?.[0]?.message?.content || '';
        let parsed;
        
        try {
            let cleanedText = textOutput.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
            parsed = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error('[服务器] JSON 解析失败, 原始输出:', textOutput);
            parsed = { 
                quote: "这是一段直击灵魂的播客，等待你的倾听。", 
                summary: "AI 摘要生成遇到了一点小波折，但精彩内容仍在链接中。",
                tags: ["摘星译", "播客推荐"]
            };
        }

        return res.json({
            success: true,
            highlights: parsed
        });

    } catch (err) {
        console.error('[服务器] 智谱 API 调用失败!');
        if (err.response) {
            console.error('[服务器] 状态码:', err.response.status);
            console.error('[服务器] 响应数据:', err.response.data);
        } else if (err.request) {
            console.error('[服务器] 请求已发出，但未收到响应。');
            console.error('[服务器] 错误信息:', err.message);
        } else {
            console.error('[服务器] 其他错误:', err.message);
        }

        // 即使请求失败，也当作服务降级处理，保证前端不出错
        return res.json({
            success: true,
            highlights: { 
                quote: "这是一句直击灵魂的播客金句，等待你的倾听。", 
                summary: "AI 摘要服务调用超时或失败，但基础提取已完成。",
                tags: ["摘星译", "播客推荐"]
            }
        });
    }
});

// =========================================================================
// submitFeedback（B 方案）
// =========================================================================
app.post('/api/submitFeedback', async (req, res) => {
    const { feedbackContent } = req.body;
    console.log('[服务器] 收到匿名反馈:', feedbackContent);
    return res.json({
        success: true,
        message: '反馈已提交，感谢您的支持！'
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});