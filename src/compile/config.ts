import {X, DETAIL} from '../channel';
import {Config} from '../config';
import {Encoding} from '../encoding';
import {isAggregate, has} from '../encoding';
import {isMeasure} from '../fielddef';
import {POINT, LINE, TICK, CIRCLE, SQUARE, RULE, Mark} from '../mark';
import {contains, extend} from '../util';

/**
 * Augment config.mark with rule-based default values.
 */
export function initMarkConfig(mark: Mark, encoding: Encoding, config: Config) {
   return extend(
     ['filled', 'opacity', 'orient', 'align'].reduce(function(cfg, property: string) {
       const value = config.mark[property];
       switch (property) {
         case 'filled':
           if (value === undefined) {
             // Point, line, and rule are not filled by default
             cfg[property] = mark !== POINT && mark !== LINE && mark !== RULE;
           }
           break;
         case 'opacity':
           if (value === undefined && contains([POINT, TICK, CIRCLE, SQUARE], mark)) {
             // point-based marks and bar
             if (!isAggregate(encoding) || has(encoding, DETAIL)) {
               cfg[property] = 0.7;
             }
           }
           break;
         case 'orient':
           const xIsMeasure = isMeasure(encoding.x);
           const yIsMeasure = isMeasure(encoding.y);

           // When unambiguous, do not allow overriding
           if (xIsMeasure && !yIsMeasure) {
             cfg[property] = 'horizontal'; // implicitly vertical
           } else if (!xIsMeasure && yIsMeasure) {
             cfg[property] = undefined; // implicitly vertical
           }

           // In ambiguous cases (QxQ or OxO) use specified value
           // (and implicitly vertical by default.)
           break;
         // text-only
         case 'align':
          if (value === undefined) {
            cfg[property] = has(encoding, X) ? 'center' : 'right';
          }
       }
       return cfg;
     }, {}),
     config.mark
   );
}
