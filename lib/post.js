const posts = [
    require('./post/id').post, //Mandatory
    require('./post/dedupe-address').post,
    require('./post/dedupe-text').post,
    require('./post/sort').post,
    require('./post/discard-empty-text').post
];

class Post {
    constructor(opts) {
        this.opts = opts || {};
        this.opts.post = this.opts && this.opts.post || [];
        for (p of this.opts.post) {
            posts.push(require(`./post/${p}`).post);
        }
    }

    feat(f) {
        for (let post of posts) {
            f = post(f, this.opts);
        }

        return f;
    }
}

module.exports = Post;
