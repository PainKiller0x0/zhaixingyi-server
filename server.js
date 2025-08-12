const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

// =========================================================================
// Gemini API 配置
// =========================================================================
// 使用你找到的代理 API 地址
const GEMINI_API_PROXY_URL = 'https://api-proxy.me/gemini';
// 使用你自己的 Gemini API 密钥
const GEMINI_API_KEY = 'AIzaSyAUVjQgcjHhMBe0CiY0TbwwWg8tj61pg70';
const GEMINI_MODEL = 'gemini-pro';

app.use(express.json());

// =========================================================================
// 升级后的 extractM4a 接口
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

        // 提取 m4a
        const m4aRegex = /(https:\/\/media\.xyzcdn\.net\/[^\s"']+\.m4a)/;
        const m4aMatch = htmlText.match(m4aRegex);
        const m4aUrl = m4aMatch ? m4aMatch[0] : null;

        // 标题
        let podcastTitle = '未知播客标题';
        const titleRegex = /<title>(.*?)<\/title>/;
        const titleMatch = htmlText.match(titleRegex);
        if (titleMatch && titleMatch[1]) {
            podcastTitle = titleMatch[1].replace(/\s*\|\s*小宇宙/, '').trim();
        }

        // 封面
        let cover = null;
        const coverRegex = /<meta\s+property="og:image"\s+content="([^"]+)"/;
        const coverMatch = htmlText.match(coverRegex);
        if (coverMatch && coverMatch[1]) {
            cover = coverMatch[1];
        }

        // 简介 / shownote
        let shownote = null;
        const descRegex = /<meta\s+property="og:description"\s+content="([^"]+)"/;
        const descMatch = htmlText.match(descRegex);
        if (descMatch && descMatch[1]) {
            shownote = descMatch[1];
        }

        // 播客名
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
// 新增 getHighlights 接口（调用 Gemini Pro 摘要+金句+标签）
// =========================================================================
app.post('/api/getHighlights', async (req, res) => {
    const { title, shownote } = req.body;

    if (!shownote) {
        return res.json({
        success: false,
        error: '缺少节目简介（shownote），无法生成摘要。',
        });
    }

    const prompt = `
你是一个播客文案编辑，给下面的播客内容生成：
1. 一句吸引人的金句
2. 三行以内的精炼摘要
3. 3~5 个关键词标签

标题: ${title || ''}
简介: ${shownote}
输出 JSON 格式：
{
  "quote": "xxx",
  "summary": "xxx",
  "tags": ["标签1","标签2",...]
}
`;

    const finalUrl = `${GEMINI_API_PROXY_URL}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    try {
        const gRes = await axios.post(
            finalUrl,
            {
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ]
            },
            { timeout: 15000 }
        );

        const textOutput = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let parsed;
        try {
            parsed = JSON.parse(textOutput);
        } catch {
            parsed = { raw: textOutput };
        }

        return res.json({
            success: true,
            highlights: parsed
        });
    } catch (err) {
        console.error('[服务器] Gemini API 调用失败:', err.message);
        return res.json({
            success: false,
            error: 'Gemini API 调用失败'
        });
    }
});

// =========================================================================
// 原有的 submitFeedback（保留）
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