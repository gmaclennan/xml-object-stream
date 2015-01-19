var XmlObjectStream = require('./');
var fs = require('fs');
var xml = fs.readFileSync('./test.xml');

var s = new XmlObjectStream({ indent: 1 });

s.on('readable', function() {
    while (content = s.read()) {
        console.log(typeof content, content);
    }
});

s.write(xml);
