var expat = require('node-expat');
var Transform = require('readable-stream/transform');
var inherits  = require('util').inherits;
var xtend     = require('xtend');

module.exports = XmlObjectStream;

var defaults = { 
  highWaterMark: 16,
  indent: 0,
  tagFilter: noop,
  encoding: 'UTF-8'
};

// noop filter function for tags - matches all tags.
function noop(tagname) {
  return true;
}

function XmlObjectStream(options) {
  if (!(this instanceof XmlObjectStream)) return new XmlObjectStream(options);
  var self = this;

  // Force object mode - can't be overwritten by options
  this.options = xtend(defaults, options, { objectMode: true });
  this.currentNest = 0;
  this.currentNode = {};
  this.nodes = [];

  this.parser = new expat.Parser(options.encoding);

  Transform.call(this, this.options);

  this.parser.on('startElement', function(name, attrs) {
    // Only start parsing if we are nested at level `options.indent`
    // and the tag name matches the filter set in `options.tagFilter`
    if (self.currentNest >= self.options.indent && self.options.tagFilter(name)) {
      var newElement = {
        $parent: self.currentNode
      };
      // If the tag has any attributes, add them under a new key
      if (Object.keys(attrs).length > 0) {
        newElement.$attributes = attrs;
      }

      // If this is a repeated element, try to coerce it into an array.
      if (self.currentNode[name]) {
        if (self.currentNode[name] instanceof Array) {
          self.currentNode[name].push(newElement);
        } else {
          self.currentNode[name] = [ self.currentNode[name], newElement ];
        }
      } else {
        self.currentNode[name] = newElement;
      }

      self.currentNode = newElement;
    }

    self.currentNest++;
  });

  this.parser.on('text', function(text) {
    if (text.trim().length) {
      self.currentNode.$text = text.trim();
    }
  });

  this.parser.on('endElement', function(name) {
    var node = {}
      , parent = self.currentNode.$parent;

    delete self.currentNode.$parent;

    // console.log(name, parent && !parent.$parent);

    if (parent) {
      // Coerce elements with no children and no attributes to just text nodes
      if (self.currentNode.$text && Object.keys(self.currentNode).length === 1) {
        parent[name] = self.currentNode.$text;
      } else if (Object.keys(self.currentNode).length === 0) {
        // Coerce empty nodes to null
        parent[name] = null;
      }
      self.currentNode = parent;
      if (!parent.$parent) {
        self.nodes.push(parent);
        self.currentNode = {};
      }
    }
    
    self.currentNest--;
  });

  this.parser.on('error', function(error) {
    console.log(error);
  })
}

inherits(XmlObjectStream, Transform);

XmlObjectStream.prototype._transform = function(chunk, encoding, callback) {
  var ready = this.parser.write(chunk);

  // Push any nodes we have parsed.
  while (this.nodes.length) {
    this.push(this.nodes.shift());
  }

  // Check if the parser stream is keeping up, if not, wait for it before continuing.
  if (ready) {
    callback();
  } else {
    this.parser.once('drain', callback);
  }
};

XmlObjectStream.prototype._flush = function(callback) {
  // Push any remaining nodes.
  while (this.nodes.length) {
    this.push(this.nodes.shift());
  }
  callback();
};
