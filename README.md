## Export prometheus metrics with zero dependencies

```
npm install --save prometheus-metrics
```

If you don't need labels you can simply use `Prometheus.fromTuples()` method:
```js
const http = require('http')
const { Prometheus, MetricContentType } = require('prometheus-metrics');

http.createServer((req, res) => {
    if (req.url === '/metrics') {
        // generate metrics from tuples
        Prometheus.fromTuples(
            'myapp_',
            [
                [ 0, 'metric01', 'This is my metric', Math.floor(10000 * Math.random()) ], // tuple that defines metric
            ]
        ).then(p => {
            // set proper Content-Type header
            res.setHeader('Content-Type', MetricContentType);
            // return prometheus text based format body
            res.end(p.getTextBasedFormat())
        })
    } else {
        res.statusCode = 404;
        res.end();
    }
}).listen(8080)
```

Or you can instantiate `Prometheus` class and use `add()` method instead:
```js
const http = require('http')
const { Prometheus, MetricContentType, SystemMetrics } = require('prometheus-metrics');

const p = new Prometheus('myapp_');

SystemMetrics.getMetrics().then(sys => {
    // add system metrics
    p.add(...sys);

    // add metric
    p.add({
        type: 'counter',
        name: 'metric01',
        help: 'This is my value',
        values: [{
            labels: { my_label: 'abcd' },
            value: Math.floor(10000 * Math.random()),
            timestamp: Date.now(),
        }, {
            labels: { my_label: 'efgh' },
            value: Math.floor(10000 * Math.random()),
        }]
    });

    http.createServer((req, res) => {
        if (req.url === '/metrics') {
            // set proper Content-Type header
            res.setHeader('Content-Type', MetricContentType);
            // return Prometheus text based format body
            res.end(p.getTextBasedFormat())
        } else {
            res.statusCode = 404;
            res.end();
        }
    }).listen(8080)
})
```
