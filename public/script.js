const socket = io();
const kafkaForm = document.getElementById('kafka-form');
const $pauseWebsocket = $('#pauseWebsocket');
let socketConnected = {};
const fpPromise = FingerprintJS.load();
let connIndex;

const messages = document.getElementById('messages');
const $topicSelect = $('#topic');
const $listenTopicsSelect = $('#listen-topics');
const $regexFilter = $('#regexFilter');
let selectedListenTopics = [];

// Set visitor ID using FingerprintJS
fpPromise.then(fp => fp.get()).then(result => {
    const visitorId = result.visitorId;
    document.body.setAttribute('data-client', visitorId);
});

// Toggle pause/resume websocket connection
$pauseWebsocket.on('click', function (e) {
    e.preventDefault();
    togglePauseSocket();
});

function togglePauseSocket() {
    if (socketConnected[connIndex]) {
        socket.disconnect();
        $pauseWebsocket.find(".fas").toggleClass('fa-play-circle fa-pause-circle');
        socketConnected[connIndex] = false;
    } else {
        socket.connect();
        $pauseWebsocket.find(".fas").toggleClass('fa-pause-circle fa-play-circle');
        socketConnected[connIndex] = true;
    }
}

// Handle Kafka form submission
kafkaForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!connIndex) {
        toastr.error('Select a connection!');
        return;
    }

    const topic = $('#topic').val();
    const message = document.getElementById('message').value;
    const groupId = document.body.getAttribute('data-client');

    fetch('/send', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({topic, message, groupId})
    })
        .then(response => response.json())
        .then(data => console.log('Message sent:', data))
        .catch(error => console.error('Error:', error));
});

// Handle topic selection and start listening
$(document).on('click', '[data-topic]', function (e) {
    e.preventDefault();

    const topicName = $(this).attr('data-topic');
    if (!connIndex) {
        toastr.error('Select a connection!');
        return;
    }

    const mainTabNav = $('#mainTabNav');
    const mainTab = $('#mainTab');
    if (mainTabNav.find(`[data-tab="${topicName}"]`).length > 0) return;
    const hidden = mainTabNav.find(`.tab-link`).length === 0 ? '' : 'hidden';
    console.log('l', mainTabNav.find(`.tab-link`).length === 0)

    mainTabNav.append(`<button class="tab-link p-2 flex-grow" data-tab="${topicName}">${topicName}</button>`);
    mainTab.append(`
        <div id="${topicName}" class="tab-pane flex-1 min-h-[1px] ${hidden}">
            <div id="table-${topicName}"></div>
        </div>
    `);

    divTable(`#table-${topicName}`, ["Offset", "Timestamp", "Value"]);

    fetch('/listen', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({topics: [topicName], connectionIndex: connIndex})
    })
        .then(() => socketConnected[connIndex] = true)
        .catch(error => toastr.error(error.message || 'Failed to start listening'));
});

// Handle incoming Kafka messages
socket.on('kafkaMessage', (message) => {
    const {topic, offset, value, timestamp} = message;
    const tableArea = `#table-${topic}`;

    const row = `
        <div class="div-table-row">
            <div class="div-table-col">${offset}</div>
            <div class="div-table-col">${moment(timestamp).format('YYYY-MM-DD HH:mm:ss')}</div>
            <div class="div-table-col">${value}</div>
        </div>
    `;

    $(tableArea).find('.div-table-body').prepend(row);
});

// Handle connection form submission
$('#connectionSettingModal-form').submit(function (e) {
    e.preventDefault();
    const server = $('#bsServer').val();
    const label = $('#bsLabel').val();
    const method = connIndex !== undefined ? 'PUT' : 'POST';
    const url = connIndex !== undefined ? `/connections/${connIndex}` : '/connections';

    fetch(url, {
        method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({server, label})
    })
        .then(() => {
            toastr.success(`Connection ${method === 'PUT' ? 'updated' : 'saved'} successfully!`);
            $('#connectionSettingModal').addClass('hidden');
            loadConnectionList();
        })
        .catch(error => toastr.error(error.message || 'Failed to save connection'));

    $(this)[0].reset();
});

// Load connection list
function loadConnectionList() {
    fetch('/connections')
        .then(response => response.json())
        .then(data => {
            const $connectionList = $('#connectionList').empty();
            data.forEach(row => {
                $connectionList.append(`
                    <div class="list-group-item list-group-item-action mb-1 px-2 bg-gray-100 rounded-md" data-index="${row.id}">
                        <div class="flex">
                            <button class="cursor-default toggle-topic-list connect-server">
                                <i class="fas fa-fw fa-plus"></i>
                            </button>
                            <button class="btn connect-server flex-1 cursor-default">
                                <span>${row.label || row.server}</span>
                                <small class="text-muted" style="font-size: 7px; font-style: italic;">${row.server}</small>
                            </button>
                            <div class="button-wrapper">
                                <button class="btn btn-sm btn-remove"><i class="fa fa-trash fa-fw text-red-500"></i></button>
                            </div>
                        </div>
                        <ul class="server-topics hidden"></ul>
                    </div>
                `);
            });
        })
        .catch(error => toastr.error('Failed to load connections'));
}

// Load connection data into the form
function loadConnectionData(id) {
    fetch(`/connections/${id}`)
        .then(response => response.json())
        .then(data => {
            $('#bsServer').val(data.server);
            $('#bsLabel').val(data.label);
            $('#connectionSettingModal').removeClass('hidden');
            connIndex = id;
        })
        .catch(error => toastr.error('Failed to load connection data'));
}

// Remove a connection
function removeConnection(id) {
    fetch(`/connections/${id}`, {method: 'DELETE'})
        .then(() => {
            toastr.success('Connection removed successfully!');
            loadConnectionList();
        })
        .catch(error => toastr.error('Failed to remove connection'));
}

// Event listener for connection list actions
$(document).on('click', '#connectionList .btn-remove', function () {
    const id = $(this).closest('[data-index]').data('index');
    if (confirm("Are you sure?")) removeConnection(id);
});

$(document).on('click', '#connectionList .btn-edit', function () {
    const id = $(this).closest('[data-index]').data('index');
    loadConnectionData(id);
});

// Toggle visibility of topics under a connection
$(document).on('click', '.connect-server', function () {
    connIndex = $(this).closest('[data-index]').data('index');
    const $serverTopics = $(this).closest('.list-group-item').find('.server-topics').toggleClass("hidden").empty();

    fetch(`/topics?connectionIndex=${connIndex}`)
        .then(response => response.json())
        .then(topics => {
            topics.forEach(topic => {
                $serverTopics.append(`
                    <li>
                        <button data-topic="${topic}">
                            <i class="far fa-fw fa-circle text-sm cursor-default"></i> ${topic}
                        </button>
                    </li>
                `);
            });
            toastr.success("Connected but no topics!")
        })
        .catch(error => toastr.error(error.message || 'Failed to fetch topics'));
});

$(document).on('click', '[data-toggle]', function (e) {
    e.preventDefault();
    $(this).toggleClass('is-collapse');
    var toggleArea = $(this).data('toggle');
    $(toggleArea).toggleClass('hidden');
});

// Initialize the page
$(function () {
    loadConnectionList();
});
