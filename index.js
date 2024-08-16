const express = require('express');
const { KafkaClient, Producer, ConsumerGroup } = require('kafka-node');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const db = new sqlite3.Database(':memory:');

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create table
db.serialize(() => {
    db.run(`
        CREATE TABLE connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server TEXT NOT NULL,
            label TEXT
        )
    `);
});

const getKafkaClient = (server, clientId = 'kafka-client') => {
    const client = new KafkaClient({
        kafkaHost: server,
        clientId,
        requestTimeout: 10000, // Set timeout to 10 seconds (10000 ms)
    });

    client.on('error', (error) => console.error('KafkaClient error:', error));

    return client;
};

const getConnectionById = (id, callback) => {
    db.get("SELECT * FROM connections WHERE id = ?", [id], callback);
};

app.get('/topics', (req, res) => {
    const { connectionIndex } = req.query;
    getConnectionById(connectionIndex, (err, row) => {
        if (err || !row) {
            return res.status(400).json({ message: 'Invalid connection index' });
        }

        const kafkaClient = getKafkaClient(row.server);
        kafkaClient.loadMetadataForTopics([], (error, results) => {
            if (error) {
                return res.status(500).json({ message: error.message || 'Failed to load topics' });
            }

            const topics = Object.keys(results[1].metadata)
                .filter(topic => !topic.startsWith('__'))
                .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            res.json(topics);
        });
    });
});

app.post('/send', (req, res) => {
    const { topic, message, connectionIndex } = req.body;
    getConnectionById(connectionIndex, (err, row) => {
        if (err || !row) {
            return res.status(400).json({ message: 'Invalid connection index' });
        }

        const kafkaClient = getKafkaClient(row.server);
        const producer = new Producer(kafkaClient);
        const payloads = [{ topic, messages: message }];

        producer.on('ready', () => {
            producer.send(payloads, (err, data) => {
                if (err) {
                    return res.status(500).json({ message: err.message || 'Failed to send message' });
                }
                res.json(data);
            });
        });

        producer.on('error', (error) => {
            console.error('Producer error:', error);
            res.status(500).json({ message: error.message || 'Producer error' });
        });
    });
});

app.post('/listen', (req, res) => {
    const { topics, connectionIndex } = req.body;
    getConnectionById(connectionIndex, (err, row) => {
        if (err || !row) {
            return res.status(400).json({ message: 'Invalid connection index' });
        }

        const server = row.server;
        let consumerGroup;

        const startConsumerGroup = (topicsToConsume) => {
            consumerGroup = new ConsumerGroup(
                {
                    kafkaHost: server,
                    groupId: row.groupId || 'kafka-group',
                    autoCommit: true,
                },
                topicsToConsume
            );

            consumerGroup.on('message', (message) => io.emit('kafkaMessage', message));
            consumerGroup.on('error', (error) => console.error('ConsumerGroup error:', error));

            res.send({ status: `Listening to topics: ${Array.isArray(topicsToConsume) ? topicsToConsume.join(', ') : 'all except internal ones'}` });
        };

        if (topics === 'all') {
            const kafkaClient = getKafkaClient(server);
            kafkaClient.loadMetadataForTopics([], (error, results) => {
                if (error) {
                    return res.status(500).json({ message: error.message || 'Failed to load topics' });
                }

                const allTopics = Object.keys(results[1].metadata).filter(topic => !topic.startsWith('__'));
                startConsumerGroup(allTopics);
            });
        } else {
            startConsumerGroup(topics);
        }
    });
});

app.get('/connections', (req, res) => {
    db.all("SELECT * FROM connections", [], (err, rows) => {
        if (err) throw err;
        res.json(rows);
    });
});

app.post('/connections', (req, res) => {
    const { server, label } = req.body;

    const hostPortRegex = /^([a-zA-Z0-9.-]+:\d{1,5})(,[a-zA-Z0-9.-]+:\d{1,5})*$/;
    if (!hostPortRegex.test(server)) {
        return res.status(400).json({ error: 'Invalid server format. Expected format: host:port or host:port,host:port,...' });
    }

    db.run("INSERT INTO connections (server, label) VALUES (?, ?)", [server, label], function (err) {
        if (err) {
            return console.log(err.message);
        }
        res.json({ id: this.lastID });
    });
});

app.put('/connections/:id', (req, res) => {
    const { server, label } = req.body;
    const { id } = req.params;

    db.run("UPDATE connections SET server = ?, label = ? WHERE id = ?", [server, label, id], (err) => {
        if (err) {
            return console.log(err.message);
        }
        res.sendStatus(200);
    });
});

app.delete('/connections/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM connections WHERE id = ?", id, (err) => {
        if (err) {
            return console.log(err.message);
        }
        res.sendStatus(200);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
