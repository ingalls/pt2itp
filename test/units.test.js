const tape = require('tape');

const Units = require('../lib/units');

tape('Units#Encode/Decode', (t) => {
    const units = new Units();

    //Errors
    t.throws(() => {
        units.encode('1-123456789')
    }, /Cannot encode values > 8 chars/, 'Cannot encode values > 8 chars');
    t.throws(() => {
        units.encode('1-123459}')
    }, /Cannot encode ASCII values above 100/, 'Cannot encode ASCII values above 100');

    t.equals(units.encode('1-1325'), '1.4549515053');
    t.equals(units.decode('1.4549515053'), '1-1325');

    t.equals(units.encode('8000-8079'), '8000.4556485557');
    t.equals(units.decode('8000.4556485557'), '8000-8079');

    t.equals(units.encode('12a'), '12.65');
    t.equals(units.decode('12.65'), '12a');

    t.equals(units.encode('12B'), '12.66');
    t.equals(units.decode('12.66'), '12b');

    t.equals(units.decode('989'), '989');

    t.end();
});
