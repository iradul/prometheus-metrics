import * as fs from 'fs';
import { Metric } from './';

let prevCPU = process.cpuUsage();

export class SystemMetrics {
	static getMetrics(prefix = 'process_'): Promise<Metric[]> {
		return Promise.all([
			SystemMetrics.getEventLoopLag(prefix),
			SystemMetrics.getCPU(prefix),
			SystemMetrics.getMemory(prefix),
			SystemMetrics.getFileDescriptors(prefix),
			SystemMetrics.getRequests(prefix),
			SystemMetrics.getHandles(prefix),
		]).then(allMetrics => {
			const metrics: Metric[] = [];
			for (const m of allMetrics) {
				metrics.push(...m);
			}
			return Promise.resolve(metrics);
		});
	}

	private static getEventLoopLag(prefix: string): Promise<Metric[]> {
		return new Promise<Metric[]>(res => {
			const start = process.hrtime();
			setImmediate(() => {
				const delta = process.hrtime(start);
				const seconds = (delta[0] * 1e9 + delta[1]) / 1e9;
				const eventLoopLag: Metric = {
					name: prefix + 'eventloop_lag_per_second',
					help: 'Event loop lag in seconds',
					type: 'gauge',
					values: [{
						value: seconds,
						timestamp: Date.now(),
					}]
				}
				res([eventLoopLag]);
			});
		});
	}

	private static getCPU(prefix: string): Promise<Metric[]> {
		let cpu: NodeJS.CpuUsage;
		try { cpu = process.cpuUsage(); }
		catch (e) { return Promise.resolve<Metric[]>([]); }
		const now = Date.now();

		const userCPU = cpu.user - prevCPU.user;
		const systemCPU = cpu.system - prevCPU.system;
		prevCPU = cpu;

		const cpuUsage: Metric = {
			name: prefix + 'cpu_time_per_second',
			help: 'CPU usage time spent in seconds',
			type: 'counter',
			values: [{
				labels: { source: 'user' },
				value: userCPU / 1e6,
				timestamp: now,
			}, {
				labels: { source: 'system' },
				value: systemCPU / 1e6,
				timestamp: now,
			}],
		};
		return Promise.resolve([ cpuUsage ]);
	}

	private static getMemory(prefix: string): Promise<Metric[]> {
		let mem: NodeJS.MemoryUsage;
		try { mem = process.memoryUsage(); }
		catch (e) { return Promise.resolve<Metric[]>([]); }
		const now = Date.now();

		const memUsage: Metric = {
			name: prefix + 'mem_usage',
			help: 'Memory usage',
			type: 'gauge',
			values: [{
				labels: { source: 'heap_total' },
				value: mem.heapTotal,
				timestamp: now,
			}, {
				labels: { source: 'heap_used' },
				value: mem.heapUsed,
				timestamp: now,
			}, {
				labels: { source: 'external_memory' },
				value: mem.external,
				timestamp: now,
			}, {
				labels: { source: 'resident_memory' },
				value: mem.rss,
				timestamp: now,
			}],
		};
		return Promise.resolve([ memUsage ]);
	}

	private static getFileDescriptors(prefix: string): Promise<Metric[]> {
		if (process.platform !== 'linux') {
			return Promise.resolve<Metric[]>([]);
		}
		const now = Date.now();

		return new Promise(res => fs.readdir('/proc/self/fd', (err, ofds) => {
			if (err) {
				res(Promise.resolve<Metric[]>([]));
				return;
			}
			res([{
				name: prefix + 'open_file_descriptors',
				help: 'Number of open file descriptors',
				type: 'gauge',
				values: [{
					value: ofds.length - 1,
					timestamp: now,
				}],
			}]);
		}));
	}

	private static getRequests(prefix: string): Promise<Metric[]> {
		if (!(<any>process)._getActiveRequests) {
			return Promise.resolve<Metric[]>([]);
		}
		const reqs: Metric = {
			name: prefix + 'active_requests',
			help: 'Number of active requests',
			type: 'gauge',
			values: [{
				value: (<any>process)._getActiveRequests().length,
				timestamp: Date.now(),
			}],
		}
		return Promise.resolve([reqs]);
	}

	private static getHandles(prefix: string): Promise<Metric[]> {
		if (!(<any>process)._getActiveHandles) {
			return Promise.resolve<Metric[]>([]);
		}
		const handles: Metric = {
			name: prefix + 'active_handles',
			help: 'Number of active handles',
			type: 'gauge',
			values: [{
				value: (<any>process)._getActiveHandles().length,
				timestamp: Date.now(),
			}],
		}
		return Promise.resolve([handles]);
	}
}
