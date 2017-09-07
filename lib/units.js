class Units {
    isUnit(str) {
        return isNaN(Number(str));
    }

    encode(str) {
        str = String(str);

        if (!this.isUnit(str)) return str;

        if (!str.match(/^\d+/)) return false;

        let num = str.match(/^\d+/)[0];
        let unit = str.replace(/^\d+/, '');

        if (!unit || !unit.length) return num;
        if (unit.length > 8) throw new Error('Cannot encode values > 8 chars');

        let encoded = '';

        unit = unit.toUpperCase();
        for (let unit_it = 0; unit_it < unit.length; unit_it++) {
            let code = unit.charCodeAt(unit_it);

            if (code > 100) throw new Error(`Cannot encode ASCII values above 100 - ${unit}`);

            encoded = encoded + String(code);
        }

        return `${num}.${encoded}`;
    }

    decode(str) {
        str = String(str);

        let num = str.split('.')[0];
        let unit = str.split('.')[1];

        if (!unit) return num;

        if (unit.length % 2 === 1) unit = unit + '0';

        let decoded = '';

        for (let unit_it = 0; unit_it < unit.length; unit_it = unit_it + 2) {
            decoded = decoded + String.fromCharCode(parseInt(unit[unit_it] + unit[unit_it + 1]));
        }

        return num + decoded.toLowerCase();
    }
}

module.exports = Units;
