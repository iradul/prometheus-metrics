import { SystemMetrics } from './system';

export { SystemMetrics };

export const MetricContentType = 'text/plain; version=0.0.4';

export type MetricValue = number | '+Inf' | '-Inf' | 'Nan';

export interface MetricRecord {
    labels?: any;
    value: MetricValue;
    timestamp?: number;
}

export interface Metric {
    skip?: boolean;
    name: string;
    help: string;
    type: 'counter' | 'gauge' | 'histogram' | 'summary' | 'untyped';
    values: MetricRecord[];
}

export type MetricTuple = [
    /**Metric type: 0=counter 1=guage */
    0 | 1,
    /**Metric name */
    string,
    /**Metric help */
    string,
    /**Metric value */
    MetricValue,
];

export interface TupleConfig {
    prefix: string;
    tuples: Array<MetricTuple>;
    sysMetrics: boolean;
    sysPrefix?: string;
}

function escapeString(str: string) {
	return str.replace(/\n/g, '\\n').replace(/\\(?!n)/g, '\\\\');
}
function escapeLabelValue(str: string) {
	if (typeof str !== 'string') return str;
	return escapeString(str).replace(/"/g, '\\"');
}

function getValueAsString(value: MetricValue) {
    if (typeof(value) === 'number') {
        if (Number.isNaN(value)) {
            return 'Nan';
        } else if (!Number.isFinite(value)) {
            if (value < 0) {
                return '-Inf';
            } else {
                return '+Inf';
            }
        }
    }
    return `${value}`;
}

export class Prometheus {
    private metrics: Metric[] = [];

    /**
     * Generates Prometheus instance from tuples.
     * @param cfg.tuples Array of metric tuples defined as `[ type, name, help, value ]`
     */
    public static fromTuples(prefix: string, tuples: Array<MetricTuple>): Promise<Prometheus>;
    public static fromTuples(cfg: TupleConfig): Promise<Prometheus>;
    public static fromTuples(x: any): Promise<Prometheus> {
        let cfg: TupleConfig;
        if (typeof(x) === 'object') {
            cfg = x;
        } else {
            cfg = {
                prefix: arguments[0],
                tuples: arguments[1],
                sysMetrics: true,
            }
        }
        const metrics: Metric[] = cfg.tuples.map((r) => ({
            name: r[1],
            help: r[2],
            type: (r[0] === 1 ? 'gauge' : 'counter') as ('gauge' | 'counter'),
            values: [{ value: r[3] }],
        }));
        const prom = new Prometheus(cfg.prefix);
        if (cfg.sysMetrics) {
            return SystemMetrics.getMetrics(cfg.sysPrefix).then(sys => {
                prom.add(...sys);
                prom.add(...metrics);
                return Promise.resolve(prom);
            });
        } else {
            prom.add(...metrics);
            return Promise.resolve(prom);
        }
    }

    constructor (public prefix: string) {}

    public add(...metric: Metric[]) {
        this.metrics.push(...metric);
    }

    public getTextBasedFormat() {
        let text = '';
        for (const item of this.metrics) {
            if (item.skip) continue;
            const name = this.prefix + escapeString(item.name);
            const help = `# HELP ${name} ${escapeString(item.help)}`;
            const type = `# TYPE ${name} ${item.type}`;

            let values = '';
            for (const val of item.values || []) {
                val.labels = val.labels || {};

                let labels = '';
                for (const key of Object.keys(val.labels)) {
                    labels += `${key}="${escapeLabelValue(val.labels[key])}",`;
                }

                let metricName = this.prefix + item.name;
                if (labels) {
                    metricName += `{${labels.substring(0, labels.length - 1)}}`;
                }

                let line = `${metricName} ${getValueAsString(val.value)}`;
                if (val.timestamp !== undefined) {
                    line += ` ${val.timestamp}`;
                }
                values += `${line.trim()}\n`;
            }
            text += `${help}\n${type}\n${values}`.trim() + '\n\n';
        }
        return text;
    }
}
