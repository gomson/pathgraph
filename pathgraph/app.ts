﻿/// <reference path="node_modules/@types/snapsvg/index.d.ts"/>
/// <reference path="node_modules/@types/knockout/index.d.ts"/>

class Vec2 {
    x: number;
    y: number;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    toString() {
        return `(${this.x}, ${this.y})`;
    }
}

function add(a: Vec2, b: Vec2) {
    return new Vec2(a.x + b.x, a.y + b.y);
}

function sub(a: Vec2, b: Vec2) {
    return new Vec2(a.x - b.x, a.y - b.y);
}


function mulV(a: Vec2, b: Vec2) {
    return new Vec2(a.x * b.x, a.y * b.y);
}

function mul(a: Vec2, b: number) {
    return new Vec2(a.x * b, a.y * b);
}

function dot(a: Vec2, b: Vec2) {
    return a.x * b.x + a.y * b.y;
}

function vlength(a: Vec2) {
    return Math.sqrt(dot(a, a));
}

function normalize(a: Vec2) {
    var len = vlength(a);
    return new Vec2(a.x / len, a.y / len);
}

function reflect(i: Vec2, n: Vec2) {
    i = mul(i, 1);
    return sub(i, mul(n, 2.0 * dot(n, i)));
}

function cross(a: Vec2, b: Vec2) {
    return a.x * b.y - a.y * b.x;
}

function perp(a: Vec2) {
    return new Vec2(-a.y, a.x);
}

class Ray {
    o: Vec2;
    d: Vec2;

    constructor(o: Vec2, d: Vec2) {
        this.o = o;
        this.d = d;
    }
}

function sign(f : number) {
    return f < 0 ? -1 : 1;
}

function intersectRayLinesegment(r:Ray, a:Vec2, b:Vec2, result:Intersection) {

    var v1 = sub(r.o, a);
    var v2 = sub(b, a);
    var v3 = perp(r.d);

    var t1 = cross(v2, v1) / dot(v2, v3);
    var t2 = dot(v1, v3) / dot(v2, v3);
    if (t1 < 0 || t2 < 0 || t2 > 1) return false;

    result.p = add(r.o, mul(r.d, t1));
    result.n = perp(v2);
    result.n = mul(result.n, -sign(dot(result.n, r.d)));

    return true;
}

class Intersection {
    p: Vec2;
    n: Vec2;
}

function transformPoint(a: Vec2, mat: Snap.Matrix) {
    return new Vec2(mat.x(a.x, a.y), mat.y(a.x, a.y));
}

function transpose(mat: Snap.Matrix) {
    return Snap.matrix(mat.d, mat.c, mat.b, mat.a, 0, 0);
}

function transformDir(a: Vec2, mat: Snap.Matrix) {
    var dirTrans = transpose(mat.invert());
    return normalize(transformPoint(a, dirTrans));
}

function transformRay(ray: Ray, mat: Snap.Matrix) {
    return new Ray(transformPoint(ray.o, mat), transformDir(ray.d, mat));
}

class Material {
    outlineColor: Snap.RGB;
    fillColor: Snap.RGB;

    outlineOpacity: number;
    fillOpacity: number;

    outlineWidth: number;

    linkedElements: Thing[];

    constructor(outlineColor: Snap.RGB, fillColor: Snap.RGB, outlineOpacity: number, fillOpacity: number, outlineWidth: number) {
        this.outlineColor = outlineColor;
        this.fillColor = fillColor;
        this.outlineOpacity = outlineOpacity;
        this.fillOpacity = fillOpacity;
        this.outlineWidth = outlineWidth;
        this.linkedElements = [];
    }

    update() {
        for (var el of this.linkedElements) {
            this.apply(el.svgElement);
        }
    }

    apply(el: Snap.Element) {
        el.attr({
            fill: this.fillOpacity > 0.01 ? this.fillColor : "none",
            stroke: this.outlineColor,
            strokeWidth: this.outlineWidth,
            "fill-opacity": this.fillOpacity,
            "stroke-opacity": this.outlineOpacity,
            "vector-effect": "non-scaling-stroke",
        });
    }

    applyTo(el: Thing) {
        if (el.material) {
            var index = el.material.linkedElements.indexOf(el);
            if (index != -1) el.material.linkedElements.splice(index, 1);
        }
        el.material = this;
        this.linkedElements.push(el);
        this.apply(el.svgElement);
    }
    
}

var DEFAULT_MATERIAL: Material = new Material(Snap.rgb(255, 0, 0), Snap.rgb(200, 200, 200), 1.0, 0.5, 2);
var CAM_MATERIAL: Material = new Material(Snap.rgb(0, 0, 0), Snap.rgb(200, 200, 200), 1.0, 0.5, 2);
var PATH_MATERIAL: Material = new Material(Snap.rgb(0, 255, 0), Snap.rgb(200, 200, 200), 1.0, 0.0, 2);

class Thing {
    paper: Snap.Paper;
    svgElement: Snap.Element;
    material: Material;

    constructor(s: Snap.Paper) {
        this.paper = s;
    }

    setup() {
        this.svgElement = this.makeSvg(this.paper);
        this.setMaterial(DEFAULT_MATERIAL);
    }

    setMaterial(mat: Material) {
        this.material = mat;
        this.material.applyTo(this);
    }

    transform(): Snap.Matrix {
        return this.svgElement.transform().globalMatrix;
    }

    pos(): Vec2 {
        var trans = this.transform();
        var split = trans.split();
        return new Vec2(split.dx, split.dy);
    }

    rot(): number {
        var trans = this.transform();
        var split = trans.split();
        return split.rotate;
    }

    scale(): Vec2 {
        var trans = this.transform();
        var split = trans.split();
        return new Vec2(split.scalex, split.scaley);
    }

    setTransform(mat: Snap.Matrix) {
        this.svgElement.attr({ transform: mat });
    }

    setPos(pos: Vec2) {
        var trans = this.transform();
        var split = trans.split();
        trans.translate(-split.dx + pos.x, -split.dy + pos.y);
        this.setTransform(trans);
    }

    setRotation(rot: number) {
        var trans = this.transform();
        var split = trans.split();
        trans.rotate(-split.rotate + rot);
        this.setTransform(trans);
    }

    setScale(scale: Vec2) {
        var trans = this.transform();
        var split = trans.split();
        trans.scale(scale.x / split.scalex, scale.y / split.scaley);
        this.setTransform(trans);
    }


    makeSvg(s: Snap.Paper): Snap.Element {
        return null;
    }
}

class Shape extends Thing {

    constructor(s: Snap.Paper) {
        super(s);
    }

    intersect(ray: Ray, result: Intersection): boolean { return false }
}

class Circle extends Shape {
    constructor(pos: Vec2, rad: number, s: Snap.Paper) {
        super(s);
        this.setup();
        this.setPos(pos);
        this.setScale(new Vec2(rad, rad));
    }

    intersect(ray: Ray, result : Intersection) {
        ray = transformRay(ray, this.transform().invert());

        var t0: number;
        var t1: number; // solutions for t if the ray intersects 

        var L = mul(ray.o, -1);
        var tca = dot(L, ray.d);

        var d2 = dot(L, L)  - tca * tca;
        if (d2 > 1) return false;
        var thc = Math.sqrt(1 - d2);
        t0 = tca - thc;
        t1 = tca + thc; 

        if (t0 > t1) {
            var tmp = t0;
            t0 = t1;
            t1 = tmp;
        }

        if (t0 < 0) {
            t0 = t1; // if t0 is negative, let's use t1 instead 
            if (t0 < 0) return false; // both t0 and t1 are negative 
        }

        result.p = add(ray.o, mul(ray.d, t0));
        result.n = normalize(result.p);

        result.p = transformPoint(result.p, this.transform());
        result.n = transformDir(result.n, this.transform());

        return true; 
    }

    makeSvg(s: Snap.Paper) {
        var el = s.circle(0, 0, 1);
        el.data("thing", this);
        return el;
    }
}


class Box extends Shape {

    constructor(pos: Vec2, size: Vec2, s: Snap.Paper) {
        super(s);
        this.setup();
        this.setPos(pos);
        this.setScale(size);
    }

    intersect(ray: Ray, result: Intersection) {
        ray = transformRay(ray, this.transform().invert());

        var corners = [
            new Vec2(0, 0),
            new Vec2(1, 0),
            new Vec2(1, 1),
            new Vec2(0, 1)
        ];

        var minDist = 20000000;
        var hitSomething = false;
        for (var i = 0; i < 4; i++) {
            var curr = corners[i];
            var next = corners[(i + 1) % 4];
            var intersect = new Intersection();

            if (intersectRayLinesegment(ray, curr, next, intersect)) {
                hitSomething = true;
                var dist = vlength(sub(intersect.p, ray.o));

                if (dist < minDist) {
                    minDist = dist;
                    result.p = intersect.p;
                    result.n = intersect.n;
                }
            }
        }

        if (!hitSomething) return false;

        result.p = transformPoint(result.p, this.transform());
        result.n = transformDir(result.n, this.transform());
        return true;
    }

    makeSvg(s: Snap.Paper) {
        var el = s.rect(0, 0, 1, 1);

        el.data("thing", this);

        return el;
    }
}

class Polygon extends Shape {
    points: Vec2[];

    constructor(points: Vec2[], s: Snap.Paper) {
        super(s);
        this.points = points;
        this.setup();
    }

    intersect(ray: Ray, result: Intersection) {
        ray = transformRay(ray, this.transform().invert());

        var minDist = 20000000;
        var hitSomething = false;
        for (var i = 0; i < this.points.length; i++) {
            var curr = this.points[i];
            var next = this.points[(i + 1) % this.points.length];
            var intersect = new Intersection();

            if (intersectRayLinesegment(ray, curr, next, intersect)) {
                hitSomething = true;
                var dist = vlength(sub(intersect.p, ray.o));

                if (dist < minDist) {
                    minDist = dist;
                    result.p = intersect.p;
                    result.n = intersect.n;
                }
            }
        }

        if (!hitSomething) return false;

        result.p = transformPoint(result.p, this.transform());
        result.n = transformDir(result.n, this.transform());
        return true;
    }

    makeSvg(s: Snap.Paper) {
        var posArray: number[] = [];

        for (var p of this.points) {
            posArray.push(p.x, p.y );
        }

        var el = s.polygon(posArray);

        el.data("thing", this);

        return el;
    }
}

class Camera extends Thing {

    constructor(pos: Vec2, rot: number, s: Snap.Paper) {
        super(s);
        this.setup();
        this.setPos(pos);
        this.setRotation(rot);
    }

    forward() {
        return transformDir(new Vec2(1, 0), this.transform());
    }

    lookAt(target: Vec2, pos?: Vec2) {
        var trans = this.transform().split();
        if (!pos) {
            pos = new Vec2(trans.dx, trans.dy);
        } else {
            this.setPos(pos);
        }

        var dir = normalize(sub(target, pos));
        var angle = Snap.angle(1, 0, dir.x, dir.y);
        this.setRotation(angle);
    }

    makeSvg(s: Snap.Paper) {
        var el = s.path("M 0,0 30,30 A 60,60 1 0,0 30,-30 Z");
        el.data("thing", this);
        return el;
    }
}

class PathData {
    points: Intersection[];
}

class Path extends Thing {
    data: PathData;

    constructor(data: PathData, s: Snap.Paper) {
        super(s);
        this.data = data;
        this.setup();
    }

    makeSvg(s: Snap.Paper) {
        var posArray: number[] = [];

        var g = s.group();

        for (var i of this.data.points) {
            posArray.push(i.p.x, i.p.y);

            var normTarget = add(i.p, mul(i.n, 10));
            var norm = s.line(i.p.x, i.p.y, normTarget.x, normTarget.y);
            DEFAULT_MATERIAL.apply(norm);
            g.add(norm);
        }

        var line = s.polyline(posArray);
        PATH_MATERIAL.apply(line);
        g.add(line);

        g.data("thing", this);

        g.attr({ "z-index": -1 });
        
        return g;
    }
}

interface Sampler {
    tracePath(ray: Ray, depth: number, scene: Scene): PathData[];
}


class Scene extends Shape {
    shapes: KnockoutObservableArray<Shape>;

    paths: Path[];

    cameras: KnockoutObservableArray<Camera>;

    materials: KnockoutObservableArray<Material>;

    sampler: Sampler;

    constructor(sampler : Sampler, s: Snap.Paper) {
        super(s);
        this.sampler = sampler;
        this.shapes = ko.observableArray<Shape>([]);
        this.paths = [];
        this.cameras = ko.observableArray<Camera>([]);
        this.materials = ko.observableArray<Material>([]);
        this.setup();
        s.drag(this.onMove, null, this.onDragEnd, this, this, this);

        this.recalculatePaths();
    }

    onDragEnd(event: any) {
        this.recalculatePaths();
    }

    onMove(dx: number, dy: number, x: number, y: number, event: any) {
        this.recalculatePaths();
    }

    recalculatePaths() {
        for (var path of this.paths) {
            path.svgElement.remove();
        }

        this.paths = [];

        for (var cam of this.cameras()) {
            var startRay = new Ray(cam.pos(), cam.forward());
            var newPaths = this.sampler.tracePath(startRay, 10, this);
            for (var p of newPaths) {
                var path = new Path(p, this.paper);
                this.paths.push(path);
            }
        }
    }

    addCamera(cam: Camera) {
        this.cameras.push(cam);
        cam.svgElement.drag();
        this.recalculatePaths();
    }

    addShape(shape: Shape) {
        this.shapes.push(shape);
        this.svgElement.add(shape.svgElement);
        shape.svgElement.drag();
        this.recalculatePaths();
    }

    intersect(ray: Ray, result: Intersection) {
        var minDist: number = 2000000;
        var hitSomething = false;
        for (var shape of this.shapes()) {
            var intersect: Intersection = new Intersection();
            if (shape.intersect(ray, intersect)) {
                hitSomething = true;
                var dist = vlength(sub(ray.o, intersect.p));
                if (dist < minDist) {
                    result.p = intersect.p;
                    result.n = intersect.n;
                    minDist = dist;
                }
            }
        }

        return hitSomething;
    }

    makeSvg(s: Snap.Paper) {
        var elements: Snap.Element[] = [];
        var group = s.group();
        
        group.data("thing", this);

        return group;
    }
}

class SinglePathSampler implements Sampler {
    tracePath(ray: Ray, depth: number, scene: Scene): PathData[] {
        var path: PathData = new PathData();
        path.points = [];

        path.points.push({ p: ray.o, n: ray.d});

        for (var i = 0; i < depth; i++) {
            var intersect: Intersection = new Intersection();

            if (!scene.intersect(ray, intersect)) {
                path.points.push({ p: add(ray.o, mul(ray.d, 20000)), n: ray.d});
                break;
            }

            path.points.push(intersect);

            ray.o = intersect.p;
            ray.d = reflect(ray.d, intersect.n);
            ray.o = add(ray.o, mul(ray.d, 0.1));

        }


        return [path];
    }
}



function makeRaySVG(s: Snap.Paper, r: Ray, length: number) {
    var target = add(r.o, mul(r.d, length));
    return s.line(r.o.x, r.o.y, target.x, target.y);
}

declare function unescape(s:string): string;


function toDataUrl(e: Snap.Element, maxWidth: number, maxHeight: number) {
    var bb = e.getBBox();

    var svg = Snap.format('<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}" viewBox="{x} {y} {width} {height}">{contents}</svg>', {
        x: Math.max(+bb.x.toFixed(3), 0),
        y: Math.max(+ bb.y.toFixed(3), 0),
        width: Math.min(+ bb.width.toFixed(3), maxWidth),
        height: Math.min(+ bb.height.toFixed(3), maxHeight),
        contents: e.outerSVG()
    });
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

var s: Snap.Paper;

window.onload = () => {
    s = Snap("#svg-container");

    var cam = new Camera(new Vec2(100, 100), 45, s);

    CAM_MATERIAL.applyTo(cam);

    var scene = new Scene(new SinglePathSampler(), s);

    scene.addCamera(cam);

    scene.addShape(new Circle(new Vec2(150, 150), 50, s));

    var deformedCircle = new Circle(new Vec2(250, 150), 30, s);
    deformedCircle.setScale(new Vec2(30.0, 10.0));
    deformedCircle.setRotation(0);
    scene.addShape(deformedCircle);
    scene.addShape(new Box(new Vec2(250, 50), new Vec2(20, 40), s));

    var mat = Snap.matrix();

    var points: Vec2[] = [];

    var xAxis = new Vec2(1, 0);

    var count = 40;

    for (var i = 0; i < count; i++) {
        mat.rotate(360 / count);

        var angle = 360 / count * i;

        var p = transformPoint(xAxis, mat);
        points.push(mul(p, Math.sin(angle * 4) * 0.5 * Math.cos(angle + 10) + 2.0));
    }

    var poly = new Polygon(points, s);

    poly.setScale(new Vec2(40, 40));

    scene.addShape(poly);

    ko.applyBindings(scene);
}

function saveSvg() {
    var svgEl = document.getElementById("svg-container");
    var width = svgEl.clientWidth;
    var height = svgEl.clientHeight;
    var saveButton = document.getElementById("save-button");
    saveButton.setAttribute("href", toDataUrl(s, width, height));
}