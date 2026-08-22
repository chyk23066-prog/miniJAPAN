import {union as turfUnion} from '@turf/union';
import {featureCollection} from '@turf/helpers';

export default function(...features) {
    return features.length > 1 ? turfUnion(featureCollection(features)) : features[0];
}
