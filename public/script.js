const socket = io();
const kafkaForm = document.getElementById('kafka-form');
const messages = document.getElementById('messages');
const $topicSelect = $('#topic');
const $listenTopicsSelect = $('#listen-topics');
const $pauseWebsocket = $('#pauseWebsocket');
const $regexFilter = $('#regexFilter');
let selectedListenTopics = [];
let socketPaused = false;
const fpPromise = FingerprintJS.load();
let connIndex;

fpPromise.then(fp => fp.get()).then(result => {
    const visitorId = result.visitorId;
    document.body.setAttribute('data-client', visitorId)
});

function fetchTopics() {
    if (!connIndex) {
        toastr.error('Select a connection!');
        return;
    }

    fetch(`/topics?connectionIndex=${connIndex}`)
        .then(response => {
            if (!response.ok) {
                return response.json().then(error => {
                    throw new Error(error.message || 'Failed to fetch topics');
                });
            }
            return response.json();
        })
        .then(topics => {
            const topicList = document.querySelector('.topic-list');
            topicList.innerHTML = '';
            topics.forEach(topic => {
                const option = new Option(topic, topic);
                $topicSelect.append(option);
                const checkbox = document.createElement('div');
                checkbox.className = 'my-form-check';
                checkbox.setAttribute('data-value', topic);
                checkbox.innerHTML = `<input type="checkbox" value="${topic}" id="${topic}">
                    <label for="${topic}">
                        ${topic}
                    </label>`;
                topicList.appendChild(checkbox);
            });
            $listenTopicsSelect.select2({
                placeholder: "Filter topics",
                allowClear: true
            });
        })
        .catch(({message}) => {
            toastr.error(message);
        });

}

$pauseWebsocket.on('click', function (e) {
    e.preventDefault();
    togglePauseSocket();
});

function togglePauseSocket(){
    if (socketPaused) {
        socket.connect();
        $(this).find(".fas").toggleClass('fa-play-circle fa-pause-circle');
        socketPaused = false;
    } else {
        socket.disconnect();
        $(this).find(".fas").toggleClass('fa-pause-circle fa-play-circle');
        socketPaused = true;
    }
}

document.getElementById('applyFilter').addEventListener('click', () => {
    selectedListenTopics = Array.from(document.querySelectorAll('.topic-list input:checked')).map(checkbox => checkbox.value);
    fetchListenTopic(selectedListenTopics);
    $('#filterTopicModal').modal('hide');
    toastr.success(`Now only listen to topics: ${selectedListenTopics}`);
});

$(document).on('click', '#topicsClearSelection', function (e) {
    e.preventDefault();
    $(document).find('.topic-list [type="checkbox"]').toggle()
});

document.getElementById('applyRegexFilter').addEventListener('click', () => {
    const regex = new RegExp($regexFilter.val(), 'i');
    Array.from(messages.children).forEach(row => {
        const valueColumn = row.querySelector('.response-column:nth-child(3)');
        if (!regex.test(valueColumn.textContent)) {
            row.style.display = 'none';
        } else {
            row.style.display = 'flex';
        }
    });
});

kafkaForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!connIndex) {
        toastr.error('Select a connection!');
        return;
    }
    const topic = $('#topic').val();
    const message = document.getElementById('message').value;

    const groupId = $(document).find('body').data('client');
    fetch('/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({topic, message})
    })
        .then(response => response.json())
        .then(data => {
            console.log('Message sent:', data);
        })
        .catch(error => {
            console.error('Error:', error);
        });
});

function fetchListenTopic(topics) {
    if (!connIndex) {
        toastr.error('Select a connection!');
        return;
    }

    const nTopics = (!topics || topics.length === 0) ? 'all' : topics;
    fetch(`/listen`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            topics: nTopics,
            connectionIndex: connIndex
        })
    })
        .then(response => response.json())
        .catch(error => {
            toastr.error(error);
        });
}

$listenTopicsSelect.on('change', function () {
    selectedListenTopics = $listenTopicsSelect.val();
    fetchListenTopic(selectedListenTopics);
});

socket.on('kafkaMessage', (message) => {
    $(document).find('.init').remove();
    const row = document.createElement('div');
    row.className = 'response-row';

    const topicCol = document.createElement('div');
    topicCol.className = 'response-column';
    topicCol.textContent = message.topic;
    row.appendChild(topicCol);

    const timestampCol = document.createElement('div');
    timestampCol.className = 'response-column';
    timestampCol.textContent = moment(message.timestamp).format('YYYY-MM-DD HH:mm:ss');
    row.appendChild(timestampCol);

    const valueCol = document.createElement('div');
    valueCol.className = 'response-column';
    try {
        const jsonValue = JSON.parse(message.value);
        valueCol.textContent = JSON.stringify(jsonValue, null, 2);
    } catch (e) {
        valueCol.textContent = message.value;
    }
    row.appendChild(valueCol);

    messages.insertBefore(row, messages.firstChild);
});

document.querySelector('.overlay').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.remove('active');
    document.querySelector('.overlay').classList.remove('active');
});

document.getElementById('messageModal').addEventListener('shown.bs.modal', () => {
});
document.getElementById('messageModal').addEventListener('hidden.bs.modal', () => {
});

$(document).on('click', '.response-row .response-column:nth-child(3)', function () {
    const styles = {style: 'height:inherit; overflow:inherit'};
    $(this).attr(styles);
    $(this).closest('.response-row').attr(styles);
});

$(document).on('click', '.clear-item', function (e) {
    e.preventDefault();
    $(document).find('.response-row').remove();
});

$(document).on('click', '.sidebar2 .btn-close2, .btn-connection', function (e) {
    e.preventDefault();
    $(document).find('.sidebar2').toggle();
});

$(document).on('keyup', '#filterListTopic', function (e) {
    const value = $(this).val();
    if (value.length < 0) return;
    $(document).find('#filterTopicModal-form').find('.my-form-check').each(function (i, $div) {
        const thisValue = $(this).data('value');
        if (thisValue.toLowerCase().indexOf(value.toLowerCase()) === -1) {
            $(this).hide();
        } else {
            $(this).show();
        }
    });
});

$(document).on('click', '#connectionList .btn-remove', function (e) {
    e.preventDefault();
    const id = $(this).closest('[data-index]').data('index');
    if (window.confirm("Are you sure?")) {
        removeConnection(id);
    }
})

$(document).on('click', '#connectionList .btn-edit', function (e) {
    e.preventDefault();
    const id = $(this).closest('[data-index]').data('index');
    loadConnectionData(id);
})

$(document).on('click', '.connect-server:not(.btn-remove,.btn-edit)', function (e) {
    e.preventDefault();
    connIndex = $(this).closest('[data-index]').data('index');
    $(this).closest("#connectionList").find('.fa-play-circle,.fa-pause-circle').toggleClass('fa-play-circle fa-pause-circle');
    fetchListenTopic();
    fetchTopics();
})

$('#connectionSettingModal-form').submit(function (e) {
    e.preventDefault();
    const server = $('#bsServer').val();
    const label = $('#bsLabel').val();
    const data = {server, label};

    if (connIndex !== undefined) {
        fetch(`/connections/${connIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(response => {
            if (response.ok) {
                toastr.success('Connection updated successfully!');
                $('#connectionSettingModal').modal('hide');
                loadConnectionList();
            } else {
                toastr.error('Failed to update connection');
            }
        });
    } else {
        fetch('/connections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(error => {
                        throw new Error(error.error || 'Failed to save connection');
                    });
                }
                return response.json();
            })
            .then(data => {
                toastr.success('Connection saved successfully!');
                $('#connectionSettingModal').modal('hide');
                loadConnectionList();
            })
            .catch(error => {
                toastr.error(error.message || 'Failed to save connection');
            });
    }

    $(this)[0].reset();
});

function loadConnectionList() {
    fetch('/connections')
        .then(response => response.json())
        .then(data => {
            $('#connectionList').empty();
            data.forEach(row => {
                $('#connectionList').append(`<li class="list-group-item list-group-item-action p-0" data-index="${row.id}">
                    <i class="fas fa-fw fa-play-circle text-danger float-start connect-server" style="margin-top: 8px;"></i>
                    <button href="#" class="btn connect-server">
                        <span>${row.label.length === 0 ? row.server : row.label}</span>
                        <small class="text-muted" style=" font-size: 7px; font-style: italic; ">
                            ${row.server}</small>
                    </button>
                    <span class="button-wrapper float-end" style="margin-top: -25px">
                            <button class="btn btn-sm btn-remove"><i class="fa fa-trash fa-fw text-danger"></i></button>
                            <button class="btn btn-sm btn-edit"><i class="fa fa-pencil-alt fa-fw text-primary"></i></button>
                        </span>
                </li>`);
            });
        }).catch(error => {
        toastr.error('Failed to load connections');
    });
}

function loadConnectionData(id) {
    fetch(`/connections/${id}`)
        .then(response => response.json())
        .then(data => {
            $('#bsServer').val(data.server);
            $('#bsLabel').val(data.label);
            $('#connectionSettingModal').modal('show');
            connIndex = id;
        }).catch(error => {
        toastr.error('Failed to load connection data');
    });
}

function removeConnection(id) {
    fetch(`/connections/${id}`, {
        method: 'DELETE'
    }).then(response => {
        if (response.ok) {
            toastr.success('Connection removed successfully!');
            loadConnectionList();
        } else {
            toastr.error('Failed to remove connection');
        }
    }).catch(error => {
        toastr.error('Failed to remove connection');
    });
}

$(function () {
    loadConnectionList();
});
