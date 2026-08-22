import {bearing} from '@turf/bearing';
import {distance} from '@turf/distance';
import {destination} from '@turf/destination';
import {lineIntersect as lineIntersects} from '@turf/line-intersect';
import {flattenEach} from '@turf/meta';
import {point, lineString, isObject} from '@turf/helpers';
import {getCoords} from '@turf/invariant';

// Use the location to calulate a weight and pick a closer point
export default function(lines, pt, location, options) {
    // Optional parameters
    options = options || {};
    if (!isObject(options)) throw new Error('options is invalid');

    // validation
    const type = (lines.geometry) ? lines.geometry.type : lines.type;
    if (type !== 'LineString' && type !== 'MultiLineString') {
        throw new Error('lines must be LineString or MultiLineString');
    }

    let closestPt = point([Infinity, Infinity], {
        pointDistance: Infinity,
        score: Infinity
    });

    let length = 0.0;
    flattenEach(lines, line => {
        const coords = getCoords(line);

        for (let i = 0; i < coords.length - 1; i++) {
            //start
            const start = point(coords[i]);
            start.properties.pointDistance = distance(pt, start, options);
            start.properties.score = start.properties.pointDistance + Math.abs(length - location) / 100;
            //stop
            const stop = point(coords[i + 1]);
            stop.properties.pointDistance = distance(pt, stop, options);
            // sectionLength
            const sectionLength = distance(start, stop, options);
            stop.properties.score = stop.properties.pointDistance + Math.abs(length + sectionLength - location) / 100;
            //perpendicular
            const heightDistance = Math.max(start.properties.pointDistance, stop.properties.pointDistance);
            const direction = bearing(start, stop);
            const perpendicularPt1 = destination(pt, heightDistance, direction + 90, options);
            const perpendicularPt2 = destination(pt, heightDistance, direction - 90, options);
            const intersect = lineIntersects(
                lineString([perpendicularPt1.geometry.coordinates, perpendicularPt2.geometry.coordinates]),
                lineString([start.geometry.coordinates, stop.geometry.coordinates])
            );
            let intersectPt = null;
            if (intersect.features.length > 0) {
                intersectPt = intersect.features[0];
                intersectPt.properties.pointDistance = distance(pt, intersectPt, options);
                intersectPt.properties.totalDistance = length + distance(start, intersectPt, options);
                intersectPt.properties.score = intersectPt.properties.pointDistance + Math.abs(intersectPt.properties.totalDistance - location) / 100;
            }

            if (start.properties.score < closestPt.properties.score) {
                closestPt = start;
                closestPt.properties.segmentIndex = i;
                closestPt.properties.totalDistance = length;
            }
            if (stop.properties.score < closestPt.properties.score) {
                closestPt = stop;
                closestPt.properties.segmentIndex = i + 1;
                closestPt.properties.totalDistance = length + sectionLength;
            }
            if (intersectPt && intersectPt.properties.score < closestPt.properties.score) {
                closestPt = intersectPt;
                closestPt.properties.segmentIndex = i;
            }
            // update length
            length += sectionLength;
        }

    });

    return closestPt;
}
