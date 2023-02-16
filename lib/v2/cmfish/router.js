module.exports = function (router) {
    router.get('/:fid/:dateline?/:orderby?/:filter?', require('./forum')); // fid=25&orderby=lastpost&filter=dateline&dateline=604800
};
