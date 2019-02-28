const fs = require('fs');

const defaults = [ //Mandatory Steps
    require('../post/intersections').post,
    require('../post/props').post,
    require('../post/id').post,
    require('../post/text').post,
    require('../post/dedupe-address').post,
    require('../post/sort').post,
    require('../post/centre').post,
    require('../post/internal').post
];

/**
 * Perform post-interpolated operations
 *
 * @class Post
 */
class Post {
    /**
     * Construct a new Post object
     *
     * @param {object} opts Config options
     * @param {object} args PT2ITP CLI Args
     * @returns Post
     */
    constructor(opts = {}, args = {}) {
        this.opts = opts || {};

        this.opts.args = args || {};

        this.opts.post = this.opts.post || [];

        if (args.warn) {
            this.opts.warn = fs.createWriteStream(args.warn, {
                flags: 'a'
            });
        }

        this.opts.label = require('../label/' + (opts.label || 'titlecase'))()

        if (opts.noDefaults) {
            this.posts = [];
        } else {
            this.posts = defaults;
        }

        for (let p of this.opts.post) {
            this.posts.push(require(`../post/${p}`).post);
        }
    }

    feat(f) {
        for (let post of this.posts) {
            f = post(f, this.opts);
        }

        return f;
    }
}

module.exports = Post;
