document.getElementById('createTopicForm').addEventListener('submit', function (event) {
    event.preventDefault();

    const topic = document.getElementById('topicName').value;
    const partitions = document.getElementById('partitions').value;
    const replicationFactor = document.getElementById('replicationFactor').value;

    const data = {
        connectionIndex: connIndex,
        topic: topic,
        partitions: parseInt(partitions, 10),
        replicationFactor: parseInt(replicationFactor, 10)
    };

    fetch('/create-topic', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(result => {
            const {message} = result;
            toastr.success('Success: ' + message);
        })
        .catch(error => {
            toastr.error('Error: ' + error.message);
        });
});
