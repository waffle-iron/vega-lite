import {COLOR, SIZE, SHAPE, Channel} from '../channel';
import {FieldDef} from '../fielddef';
import {LegendProperties} from '../legend';
import {title as fieldTitle} from '../fielddef';
import {AREA, BAR, TICK, TEXT, LINE, POINT, CIRCLE, SQUARE} from '../mark';
import {ORDINAL} from '../type';
import {extend, keys, without, Dict} from '../util';

import {applyMarkConfig, FILL_STROKE_CONFIG, formatMixins as utilFormatMixins, timeFormat} from './common';
import {COLOR_LEGEND, COLOR_LEGEND_LABEL} from './scale';
import {UnitModel} from './unit';
import {VgLegend} from '../vega.schema';


export function parseLegendComponent(model: UnitModel): Dict<VgLegend> {
  return [COLOR, SIZE, SHAPE].reduce(function(legendComponent, channel) {
    if (model.legend(channel)) {
      legendComponent[channel] = parseLegend(model, channel);
    }
    return legendComponent;
  }, {} as Dict<VgLegend>);
}

function getLegendDefWithScale(model: UnitModel, channel: Channel): VgLegend {
  switch (channel) {
    case COLOR:
      const fieldDef = model.fieldDef(COLOR);
      const scale = model.scaleName(useColorLegendScale(fieldDef) ?
        // To produce ordinal legend (list, rather than linear range) with correct labels:
        // - For an ordinal field, provide an ordinal scale that maps rank values to field values
        // - For a field with bin or timeUnit, provide an identity ordinal scale
        // (mapping the field values to themselves)
        COLOR_LEGEND :
        COLOR
      );

      return model.config().mark.filled ? { fill: scale } : { stroke: scale };
    case SIZE:
      return { size: model.scaleName(SIZE) };
    case SHAPE:
      return { shape: model.scaleName(SHAPE) };
  }
  return null;
}

export function parseLegend(model: UnitModel, channel: Channel): VgLegend {
  const fieldDef = model.fieldDef(channel);
  const legend = model.legend(channel);

  let def: VgLegend = getLegendDefWithScale(model, channel);

  // 1.1 Add properties with special rules
  def.title = title(legend, fieldDef);

  extend(def, formatMixins(legend, model, channel));

  // 1.2 Add properties without rules
  ['orient', 'values'].forEach(function(property) {
    const value = legend[property];
    if (value !== undefined) {
      def[property] = value;
    }
  });

  // 2) Add mark property definition groups
  const props = (typeof legend !== 'boolean' && legend.properties) || {};
  ['title', 'symbols', 'legend', 'labels'].forEach(function(group) {
    let value = properties[group] ?
      properties[group](fieldDef, props[group], model, channel) : // apply rule
      props[group]; // no rule -- just default values
    if (value !== undefined && keys(value).length > 0) {
      def.properties = def.properties || {};
      def.properties[group] = value;
    }
  });

  return def;
}

export function title(legend: LegendProperties, fieldDef: FieldDef) {
  if (typeof legend !== 'boolean' && legend.title) {
    return legend.title;
  }

  return fieldTitle(fieldDef);
}

export function formatMixins(legend: LegendProperties, model: UnitModel, channel: Channel) {
  const fieldDef = model.fieldDef(channel);

  // If the channel is binned, we should not set the format because we have a range label
  if (fieldDef.bin) {
    return {};
  }

  return utilFormatMixins(model, channel, typeof legend !== 'boolean' ? legend.format : undefined);
}

// we have to use special scales for ordinal or binned fields for the color channel
export function useColorLegendScale(fieldDef: FieldDef) {
  return fieldDef.type === ORDINAL || fieldDef.bin || fieldDef.timeUnit;
}

namespace properties {
  export function symbols(fieldDef: FieldDef, symbolsSpec, model: UnitModel, channel: Channel) {
    let symbols:any = {};
    const mark = model.mark();

    switch (mark) {
      case BAR:
      case TICK:
      case TEXT:
        symbols.shape = {value: 'square'};
        break;
      case CIRCLE:
      case SQUARE:
        symbols.shape = { value: mark };
        break;
      case POINT:
      case LINE:
      case AREA:
        // use default circle
        break;
    }

    const filled = model.config().mark.filled;

    applyMarkConfig(symbols, model,
      channel === COLOR ?
        /* For color's legend, do not set fill (when filled) or stroke (when unfilled) property from config because the the legend's `fill` or `stroke` scale should have precedence */
        without(FILL_STROKE_CONFIG, [ filled ? 'fill' : 'stroke']) :
        /* For other legend, no need to omit. */
        FILL_STROKE_CONFIG
    );

    if (filled) {
      symbols.strokeWidth = { value: 0 };
    }

    let value;
    if (model.has(COLOR) && channel === COLOR) {
      if (useColorLegendScale(fieldDef)) {
        // for color legend scale, we need to override
        value = { scale: model.scaleName(COLOR), field: 'data' };
      }
    } else if (model.fieldDef(COLOR).value) {
      value = { value: model.fieldDef(COLOR).value };
    }

    if (value !== undefined) {
      // apply the value
      if (filled) {
        symbols.fill = value;
      } else {
        symbols.stroke = value;
      }
    } else if (channel !== COLOR) {
      // For non-color legend, apply color config if there is no fill / stroke config.
      // (For color, do not override scale specified!)
      symbols[filled ? 'fill' : 'stroke'] = symbols[filled ? 'fill' : 'stroke'] ||
        {value: model.config().mark.color};
    }

    symbols = extend(symbols, symbolsSpec || {});

    return keys(symbols).length > 0 ? symbols : undefined;
  }

  export function labels(fieldDef: FieldDef, symbolsSpec, model: UnitModel, channel: Channel): any {
    if (channel === COLOR) {
      if (fieldDef.type === ORDINAL) {
        return {
          text: {
            scale: model.scaleName(COLOR_LEGEND),
            field: 'data'
          }
        };
      } else if (fieldDef.bin) {
        return {
          text: {
            scale: model.scaleName(COLOR_LEGEND_LABEL),
            field: 'data'
          }
        };
      } else if (fieldDef.timeUnit) {
        return {
          text: {
            template: '{{ datum.data | time:\'' + timeFormat(model, channel) + '\'}}'
          }
        };
      }
    }
    return undefined;
  }
}
