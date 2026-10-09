/* TUNGO - NDMC Campus Wayfinding
   Map data is traced from the official NDMC Campus Directory (740 x 507 reference).
   Items: [id, name, x, y, w, h, rotation, shape]  (shape: r = box, c = circle) */

var BUILDINGS = [
  ['1','Robert S. Sullivan Bldg.',546,258,14,82,-25],
  ['2','Chapel',603,377,10,10,0],
  ['3','Clinic',577,406,10,10,0],
  ['4','Gymnasium',613,414,34,52,-20],
  ['5','De Mazenod Bldg.',535,370,16,52,0],
  ['6a','Plaza Madonna Bldg.',510,452,26,10,0],
  ['7','College Library',460,390,22,52,0],
  ['8','ETD Bldg.',375,268,16,92,-10],


 
];
var FACILITIES = [
  ['A','Student Lounge 2',553,369],
  ['B','Student Lounge 1',518,374],
  ['C','Guard House',405,422],
  ['D','ETD Playground',407,376],
  ['E','ETD Covered Court',412,347],
  ['F','ETD Stage',425,410],
  ['G','Soccer Field',471,278],
  ['H','HS Stage',467,214],
  ['I','HS Student Lounge',407,157],

];

var ITEMS = [];
BUILDINGS.forEach(function (b) {
  ITEMS.push({ id: b[0], name: b[1], x: b[2], y: b[3], w: b[4], h: b[5], r: b[6], kind: 'b' });
});
FACILITIES.forEach(function (f) {
  ITEMS.push({ id: f[0], name: f[1], x: f[2], y: f[3], w: f[4] || 15, h: f[5] || 15, r: 0, kind: 'f', shape: f[4] === 'c' ? 'c' : 'r' });
});
ITEMS.forEach(function (i) { if (i.id === 'B') { i.w = 30; i.h = 30; } });

// Optional GPS: set the lat/lng of the map's top-left (nw) and bottom-right (se) corners to enable "Use GPS".
var GEO = null; // e.g. { nwLat: 0, nwLng: 0, seLat: 0, seLng: 0 }

/* ---- Building footprints for the 3D renderer: [x1,y1, x2,y2, x3,y3, x4,y4] ---- */
var BLDG = BUILDINGS.map(function (b) {
  var x = b[2], y = b[3], hw = Math.max(b[4], 11) / 2, hh = Math.max(b[5], 11) / 2, a = (b[6] || 0) * Math.PI / 180;
  var c = Math.cos(a), s = Math.sin(a), out = [];
  [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(function (p) {
    out.push(+(x + p[0] * c - p[1] * s).toFixed(2), +(y + p[0] * s + p[1] * c).toFixed(2));
  });
  return out;
});

/* ---- Footpath graph (auto-generated walkway network + doors) ----
   G.n: walkable nodes [x,y] · G.e: edges [i,j] · G.door: item id -> nearest node */
var G = (function () {
  var GROUND = [[322,100],[432,88],[505,58],[534,205],[567,300],[642,400],[642,464],[655,490],[388,490],[396,455],[330,215]];
  var TOP = [[500,40],[700,25],[710,75],[520,78]];
  function inPoly(x, y, p) {
    var c = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++)
      if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
    return c;
  }
  var PAD = BLDG.map(function (p) {
    var cx = (p[0] + p[2] + p[4] + p[6]) / 4, cy = (p[1] + p[3] + p[5] + p[7]) / 4, pts = [];
    for (var i = 0; i < 8; i += 2) {
      var dx = p[i] - cx, dy = p[i + 1] - cy, d = Math.hypot(dx, dy) || 1;
      pts.push([cx + dx / d * (d + 2.5), cy + dy / d * (d + 2.5)]);
    }
    return pts;
  });
  function blocked(x, y) {
    for (var i = 0; i < PAD.length; i++) if (inPoly(x, y, PAD[i])) return true;
    return false;
  }
  function walkable(x, y) { return (inPoly(x, y, GROUND) || inPoly(x, y, TOP)) && !blocked(x, y); }
  function cross(ax, ay, bx, by, cx, cy, dx, dy) {
    function o(px, py, qx, qy, rx, ry) {
      var v = (qx - px) * (ry - py) - (qy - py) * (rx - px);
      return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0;
    }
    return o(ax, ay, bx, by, cx, cy) !== o(ax, ay, bx, by, dx, dy) &&
           o(cx, cy, dx, dy, ax, ay) !== o(cx, cy, dx, dy, bx, by);
  }
  function segBlocked(ax, ay, bx, by) {
    for (var i = 0; i < PAD.length; i++)
      for (var k = 0; k < 4; k++) {
        var p1 = PAD[i][k], p2 = PAD[i][(k + 1) % 4];
        if (cross(ax, ay, bx, by, p1[0], p1[1], p2[0], p2[1])) return true;
      }
    return false;
  }
  var STEP = 15, X0 = 328, X1 = 706, Y0 = 22, Y1 = 494, n = [], at = {}, x, y;
  for (y = Y0; y <= Y1; y += STEP)
    for (x = X0; x <= X1; x += STEP)
      if (walkable(x, y)) { at[x + ',' + y] = n.length; n.push([x, y]); }
  var e = [], seen = {};
  function link(a, b) {
    if (a === undefined || b === undefined || a === b) return;
    var k = a < b ? a + '-' + b : b + '-' + a, A = n[a], B = n[b];
    if (seen[k] || segBlocked(A[0], A[1], B[0], B[1])) return;
    seen[k] = 1; e.push([a, b]);
  }
  for (y = Y0; y <= Y1; y += STEP)
    for (x = X0; x <= X1; x += STEP) {
      var i0 = at[x + ',' + y];
      if (i0 === undefined) continue;
      link(i0, at[(x + STEP) + ',' + y]);
      link(i0, at[x + ',' + (y + STEP)]);
      link(i0, at[(x + STEP) + ',' + (y + STEP)]);
      link(i0, at[(x + STEP) + ',' + (y - STEP)]);
    }
  var door = {};
  ITEMS.forEach(function (it) {
    var b = 0, bd = 1e9;
    for (var i = 0; i < n.length; i++) {
      var d = Math.hypot(n[i][0] - it.x, n[i][1] - it.y);
      if (d < bd) { bd = d; b = i; }
    }
    door[it.id] = b;
  });
  return { n: n, e: e, door: door };
})()
