const test = require('tape');
const Misc = require('../lib/misc');
const misc = new Misc();

test('misc.det2D', (t) => {
    t.equal(misc.det2D([0,0], [1,2], [3,4]), -2);
    t.equal(misc.det2D([0,0], [2,1], [-1,3]), 7);
    t.equal(misc.det2D([1,1], [0,1], [2,3]), -2);
    t.equal(misc.det2D([2,2], [0,-1], [-3,1]), -13);
    t.end();
});

test('misc.sign', (t) => {
    t.equal(misc.sign(5), 1);
    t.equal(misc.sign(-5), -1);
    t.equal(misc.sign(0), 0);
    t.equal(misc.sign(1), 1);
    t.equal(misc.sign(-1), -1);
    t.ok(Number.isNaN(misc.sign('22')));
    t.end();
});

test('misc.toHighest', (t) => {
    t.equals(misc.toHighest(3425, 1000), 4000);
    t.equals(misc.toHighest(1, 1000), 1000);
    t.equals(misc.toHighest(454, 1000), 1000);
    t.equals(misc.toHighest(4642364, 1000), 4643000);
    t.equals(misc.toHighest(1001, 1000), 2000);
    t.equals(misc.toHighest(1000, 1000), 1000);
    t.end();
});

test('misc.toLowest', (t) => {
    t.equals(misc.toLowest(3425, 1000), 3000);
    t.equals(misc.toLowest(1, 1000), 0);
    t.equals(misc.toLowest(454, 1000), 0);
    t.equals(misc.toLowest(4642364, 1000), 4642000);
    t.equals(misc.toLowest(1001, 1000), 1000);
    t.equals(misc.toLowest(1000, 1000), 1000);
    t.end();
});

test('misc.closest', (t) => {
    t.equals(misc.closest([1, 2, 3, 4, 5, 6, 7, 11, 145, 132, 146, 156, 294, 125, 574, 573], 1), 1);
    t.equals(misc.closest([1, 2, 3, 4, 5, 6, 7, 11, 145, 132, 146, 156, 294, 125, 574, 573], 2), 2);
    t.equals(misc.closest([1, 2, 3, 4, 5, 6, 7, 11, 145, 132, 146, 156, 294, 125, 574, 573], 3), 3);
    t.equals(misc.closest([1, 2, 3, 4, 5, 6, 7, 11, 145, 132, 146, 156, 294, 125, 574, 573], 4), 4);
    t.equals(misc.closest([1, 2, 3, 4, 5, 6, 7, 11, 145, 132, 146, 156, 294, 125, 574, 573], 12), 11);
    t.equals(misc.closest([1, 2, 3, 4, 5, 6, 7, 11, 145, 132, 146, 156, 294, 125, 574, 573], 140), 145);
    t.equals(misc.closest([1, 2, 3, 4, 5, 6, 7, 11, 145, 132, 146, 156, 294, 125, 574, 573], 500), 573);
    t.equals(misc.closest([1, 2, 3, 4, 5, 6, 7, 11, 145, 132, 146, 156, 294, 125, 574, 573], 200), 156);
    t.end();
});
