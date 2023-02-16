const got = require('@/utils/got');
const cheerio = require('cheerio');
const timezone = require('@/utils/timezone');
const { parseDate } = require('@/utils/parse-date');
const iconv = require('iconv-lite');

module.exports = async (ctx) => {
    const fid = ctx.params.fid ?? '25';
    const orderby = ctx.params.orderby ?? 'replies';
    const filter = ctx.params.orderby ?? 'dateline';
    const dateline = ctx.params.orderby ?? '86400';

    // https://bbs.tropica.cn/forum.php?mod=forumdisplay&fid=37&orderby=replies&filter=dateline&dateline=604800&orderby=replies
    const url = `https://bbs.tropica.cn/forum.php?mod=forumdisplay&fid=${fid}&orderby=${orderby}&filter=${filter}&dateline=${dateline}`;
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
            const u = new URL(a.attr('href'));
            return {
                title: t.text() + a.text(),
                link: a.attr('href'),
                pubDate: timezone(parseDate(item.find('.by em span').text()), +8),
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
                return item;
            })
        )
    );

    ctx.state.data = {
        title: '南美水族-' + $('#pt a').eq(3).text(),
        description: '南美水族',
        link: url,
        item: items,
    };
};
