var Point = function(x, y) {
    return {
        x: x,
        y: y
    }
};

var Line = function(p1, p2) {
    return {
        p1: new Point(p1.x, p1.y),
        p2: new Point(p2.x, p2.y)
    }
};

var checkIntersection = function(line1, line2) {
    var returnVal = {};

    var d = (line2.p2.y - line2.p1.y) * (line1.p2.x - line1.p1.x) - (line2.p2.x - line2.p1.x) * (line1.p2.y - line1.p1.y);
    var n_a = (line2.p2.x - line2.p1.x) * (line1.p1.y - line2.p1.y) - (line2.p2.y - line2.p1.y) * (line1.p1.x - line2.p1.x);
    var n_b = (line1.p2.x - line1.p1.x) * (line1.p1.y - line2.p1.y) - (line1.p2.y - line1.p1.y) * (line1.p1.x - line2.p1.x);
    
    if (d == 0) return false;
    
    var ua = (n_a << 14)/d;
    var ub = (n_b << 14)/d;
    
    if (ua >=0 && ua <= (1 << 14) && ub >= 0 && ub <= (1 << 14)) {
        returnVal.x = line1.p1.x + ((ua * (line1.p2.x - line1.p1.x)) >> 14);
        returnVal.y = line1.p1.y + ((ua * (line1.p2.y - line1.p1.y)) >> 14);
        return returnVal;
    }
    
    return false;
}

exports.Point = Point;
exports.Line = Line;
exports.checkIntersection = checkIntersection;
