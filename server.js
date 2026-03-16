// 这是 server.js (包含 API 版本控制，完美兼容线上旧版)
const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

// =========================================================================
// 环境变量读取
// =========================================================================
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY; 

if (!ZHIPU_API_KEY) {
    console.warn('⚠️ 警告：ZHIPU_API_KEY 环境变量未设置！AI 摘要功能将被跳过，但不影响基础的音频提取。');
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
// getHighlights 接口（调用智谱 GLM-4-Flash-250414，带有版本控制）
// =========================================================================
app.post('/api/getHighlights', async (req, res) => {
    // 💡 接收前端传来的 version 参数
    const { title, shownote, version } = req.body;

    if (!shownote) {
        return res.json({
            success: false,
            error: '缺少节目简介（shownote），无法生成摘要。',
        });
    }

    // 💡 核心向后兼容逻辑：如果没有传版本号，说明是线上的旧版小程序！
    // 直接返回空的金句和摘要，旧版客户端收到后会自动隐藏丑陋的卡片，且不报错。
    if (!version || version < '0.6.0') {
        console.log(`[服务器] 拦截到旧版客户端请求 (version: ${version || '未提供'})，已返回空数据隐藏卡片。`);
        return res.json({
            success: true,
            highlights: {
                quote: "",    // 空字符串会触发旧版前端的 wx:if 隐藏
                summary: "",
                tags: []
            }
        });
    }

    if (!ZHIPU_API_KEY) {
        console.warn('[服务器] 未配置 ZHIPU_API_KEY，放弃生成亮点。');
        return res.json({
            success: false,
            error: 'AI 摘要服务未配置，跳过亮点生成。'
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
            return res.json({
                success: false,
                error: 'AI 摘要生成内容异常。'
            });
        }

        return res.json({
            success: true,
            highlights: parsed
        });

    } catch (err) {
        console.error('[服务器] 智谱 API 调用失败!');
        return res.json({
            success: false,
            error: 'AI 摘要服务调用失败，请稍后再试'
        });
    }
});

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