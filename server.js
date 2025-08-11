const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.json());

// =========================================================================
// 迁移自 extractM4a 云函数
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
        let rawTitle = '';
        const titleRegex = /<title>(.*?)<\/title>/;
        const titleMatch = htmlText.match(titleRegex);
        if (titleMatch && titleMatch[1]) {
            rawTitle = titleMatch[1];
        } else {
            const ogTitleRegex = /<meta\s+property="og:title"\s+content="([^"]*)"\s*\/?>/;
            const ogTitleMatch = htmlText.match(ogTitleRegex);
            if (ogTitleMatch && ogTitleMatch[1]) {
                rawTitle = ogTitleMatch[1];
            }
        }
        if (rawTitle) {
            let cleanedTitle = rawTitle;
            const xiaoyuzhouSuffixIndex = cleanedTitle.indexOf(' | 小宇宙');
            if (xiaoyuzhouSuffixIndex !== -1) {
                cleanedTitle = cleanedTitle.substring(0, xiaoyuzhouSuffixIndex);
            }
            podcastTitle = cleanedTitle.replace(/[-\s]+$/, '').trim();
            if (podcastTitle === '') {
                podcastTitle = rawTitle.trim();
            }
        }

        if (m4aUrl) {
            console.log(`[服务器] 成功提取到链接: ${m4aUrl}`);
            return res.json({
                success: true,
                m4aUrl: m4aUrl,
                title: podcastTitle,
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
// 迁移自 submitFeedback 云函数
// =========================================================================
// 注意：这里的 submitFeedback 逻辑无法直接在自建服务器上使用，
// 因为它依赖 wx-server-sdk 和云数据库。我们需要一个替代方案。
// 这里我们先模拟一个成功的返回，等你备案完成后，我们可以部署一个真正的数据库。
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