'use strict';

const tape = require('tape');
const { JavaScriptNames } = require('../native/index.node');


tape('test namewrap', (t) => {
    // const names = new JavaScriptNames('Main St NE');
    // const names = new JavaScriptNames('Main St NE');
    // const names = new JavaScriptNames('{ "display": "Main St NE", "priority": 0 }');
    const names = new JavaScriptNames('[{ "display": "Main St NE", "priority": 0 }, { "display": "Main St NE", "priority": 0 }]');

    console.log(names);
    console.log(JSON.stringify(names.names()));
    t.end();
});
