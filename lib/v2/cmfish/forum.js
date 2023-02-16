const got = require('@/utils/got');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

module.exports = async (ctx) => {
    const fid = ctx.params.fid ?? '25';
    const orderby = ctx.params.orderby ?? 'replies';
    const filter = ctx.params.orderby ?? 'dateline';
    const dateline = ctx.params.orderby ?? '86400';
    const baseUrl = 'https://www.cmfish.com/bbs/';

    // https://www.cmfish.com/bbs/forum.php?mod=forumdisplay&fid=79&orderby=replies&filter=dateline&dateline=86400&orderby=replies
    // https://www.cmfish.com/bbs/forum.php?mod=forumdisplay&fid=463&orderby=replies&filter=dateline&dateline=86400&orderby=replies
    const url = `${baseUrl}/forum.php?mod=forumdisplay&fid=${fid}&orderby=${orderby}&filter=${filter}&dateline=${dateline}`;
    // console.log(url);
    const response = await got({
        method: 'get',
        url,
        responseType: 'buffer',
    });
    const $ = cheerio.load(iconv.decode(response.data, 'gbk'));

    let items = $('[id^="normalthread_"]')
        .slice(0, ctx.query.limit ? parseInt(ctx.query.limit) : 30)
        .toArray()
        .map((item) => {
            item = $(item);
            const t = item.find('em').first();
            const a = item.find('.s');
            const url = baseUrl + a.attr('href');
            const u = new URL(url);
            return {
                title: t.text() + a.text(),
                link: url,
                guid: u.searchParams.get('tid'),
                author: item.find('.by cite').text(),
            };
        });

    items = await Promise.all(
        items.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const detailResponse = await got({
                    method: 'get',
                    url: item.link,
                    responseType: 'buffer',
                });

                const $ = cheerio.load(iconv.decode(detailResponse.data, 'gbk'));
                item.description = $('.t_f').html();
                let time = $('.authi em span').attr('title');
                if (!time) {
                    time = $('.authi em').eq(0).text().replace('发表于 ', '').trimEnd();
                }
                item.pubDate = new Date(time).toUTCString();
                return item;
            })
        )
    );

    ctx.state.data = {
        title: 'cmfish-' + $('#pt a').eq(3).text(),
        description: 'cmfish',
        link: url,
        item: items,
    };
};
