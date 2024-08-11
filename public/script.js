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

fpPromise.then(fp => fp.get()).then(result => {
    const visitorId = result.visitorId;
    document.body.setAttribute('data-client', visitorId);
});

// function fetchTopics() {
//     if (!connIndex) {
//         toastr.error('Select a connection!');
//         return;
//     }
//
// }

$pauseWebsocket.on('click', function (e) {
    e.preventDefault();
    togglePauseSocket();
});

function togglePauseSocket() {
    if (socketConnected[connIndex]) {
        socket.disconnect();
        $(this).find(".fas").toggleClass('fa-play-circle fa-pause-circle');
        socketConnected[connIndex] = false;
    } else {
        socket.connect();
        $(this).find(".fas").toggleClass('fa-pause-circle fa-play-circle');
        socketConnected[connIndex] = true;
    }
}

// document.getElementById('applyFilter').addEventListener('click', () => {
//     selectedListenTopics = Array.from(document.querySelectorAll('.topic-list input:checked')).map(checkbox => checkbox.value);
//     fetchListenTopic(selectedListenTopics);
//     $('#filterTopicModal').modal('hide');
//     toastr.success(`Now only listen to topics: ${selectedListenTopics}`);
// });

// $(document).on('click', '#topicsClearSelection', function (e) {
//     e.preventDefault();
//     $(document).find('.topic-list [type="checkbox"]').toggle();
// });

// document.getElementById('applyRegexFilter').addEventListener('click', () => {
//     const regex = new RegExp($regexFilter.val(), 'i');
//     Array.from(messages.children).forEach(row => {
//         const valueColumn = row.querySelector('.response-column:nth-child(3)');
//         row.style.display = regex.test(valueColumn.textContent) ? 'flex' : 'none';
//     });
// });

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
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({topic, message, groupId})
    })
        .then(response => response.json())
        .then(data => console.log('Message sent:', data))
        .catch(error => console.error('Error:', error));
});

$(document).on('click', '[data-topic]', function (e) {
    e.preventDefault();
    let topics = [];
    let topicName = $(this).attr('data-topic');
    topics.push(topicName);
    if (!connIndex) {
        toastr.error('Select a connection!');
        return;
    }
    let mainTabNav = $(document).find('#mainTabNav');
    let mainTab = $(document).find('#mainTab');
    let tabs = [];
    mainTabNav.find('[data-tab]').each(function (i,row){
        let tabName = row.getAttribute('data-tab');
        if(tabs.indexOf(tabName) === -1) {
            tabs.push(tabName);
        }
    });
    if(tabs.indexOf(topicName) !== -1) {
        return;
    }

    mainTabNav.append(`<button class="tab-link p-2 flex-grow flex-1" data-tab="${topicName}">${topicName}</button>`);
    mainTab.append(`<div id="${topicName}" class="tab-pane flex-1 flex min-h-[1px] ${tabs.length === 0 ? '' : 'hidden'}">
                <div id="table-${topicName}"></div>
            </div>`);
    divTable(`#table-${topicName}`, ["Offset", "Timestamp", "Value"])

    fetch(`/listen`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({topics, connectionIndex: connIndex})
    })
        .then(response => response.json())
        .then(() => {
            socketConnected[connIndex] = true;
        })
        .catch(error => toastr.error(error.message || 'Failed to start listening'));
});

socket.on('kafkaMessage', (message) => {
    console.log("Message", message);
    const {topic, offset, partition, value, timestamp} = message;
    let tableArea = `#table-${topic}`;

    let row = `<div class="div-table-row">
        <div class="div-table-col">${offset}</div>
        <div class="div-table-col">${moment(timestamp).format('YYYY-MM-DD HH:mm:ss')}</div>
        <div class="div-table-col">${value}</div>
    </div>`;
    $(document).find(tableArea).find('.div-table-body').prepend(row);
});

$('#connectionSettingModal-form').submit(function (e) {
    e.preventDefault();
    const server = $('#bsServer').val();
    const label = $('#bsLabel').val();
    const data = {server, label};

    const method = connIndex !== undefined ? 'PUT' : 'POST';
    const url = connIndex !== undefined ? `/connections/${connIndex}` : '/connections';

    fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(() => {
            toastr.success(`Connection ${method === 'PUT' ? 'updated' : 'saved'} successfully!`);
            $('#connectionSettingModal').toggleClass('hidden');
            loadConnectionList();
        })
        .catch(error => toastr.error(error.message || 'Failed to save connection'));

    $(this)[0].reset();
});

function loadConnectionList() {
    fetch('/connections')
        .then(response => response.json())
        .then(data => {
            $('#connectionList').empty();
            data.forEach(row => {
                $('#connectionList').append(`
<div class="list-group-item list-group-item-action mb-1 px-2 bg-gray-100 rounded-md" data-index="${row.id}">
    <div class="flex">
        <button class="cursor-default toggle-topic-list connect-server">
            <i class="fas fa-fw fa-plus"></i>
        </button>
        <button href="#" class="btn connect-server flex flex-col flex-1 flex-grow cursor-default">
            <span>${row.label || row.server}</span>
            <small class="text-muted" style="font-size: 7px; font-style: italic;">${row.server}</small>
        </button>
        <div class="button-wrapper">
            <button class="btn btn-sm btn-remove"><i class="fa fa-trash fa-fw text-red-500"></i></button>
            <button class="btn btn-sm btn-edit"><i class="fa fa-pencil-alt fa-fw text-blue-500"></i></button>
        </div>
    </div>
    <ul class="server-topics hidden">
    </ul>
</div>`);
            });
        })
        .catch(error => toastr.error('Failed to load connections'));
}

function loadConnectionData(id) {
    fetch(`/connections/${id}`)
        .then(response => response.json())
        .then(data => {
            $('#bsServer').val(data.server);
            $('#bsLabel').val(data.label);
            $('#connectionSettingModal').modal('show');
            connIndex = id;
        })
        .catch(error => toastr.error('Failed to load connection data'));
}

function removeConnection(id) {
    fetch(`/connections/${id}`, {method: 'DELETE'})
        .then(() => {
            toastr.success('Connection removed successfully!');
            loadConnectionList();
        })
        .catch(error => toastr.error('Failed to remove connection'));
}

$(document).on('click', '.response-row .response-column:nth-child(3)', function () {
    $(this).css({height: 'inherit', overflow: 'inherit'});
    $(this).closest('.response-row').css({height: 'inherit', overflow: 'inherit'});
});

$(document).on('click', '.clear-item', function (e) {
    e.preventDefault();
    $('.response-row').remove();
});

$(document).on('click', '[data-toggle]', function (e) {
    e.preventDefault();
    $(this).toggleClass('is-collapse');
    var toggleArea = $(this).data('toggle');
    $(toggleArea).toggleClass('hidden');
});

$(document).on('keyup', '#filterListTopic', function () {
    const value = $(this).val().toLowerCase();
    $('#filterTopicModal-form .my-form-check').each(function () {
        $(this).toggle($(this).data('value').toLowerCase().includes(value));
    });
});

$(document).on('click', '#connectionList .btn-remove', function (e) {
    e.preventDefault();
    const id = $(this).closest('[data-index]').data('index');
    if (confirm("Are you sure?")) {
        removeConnection(id);
    }
});

$(document).on('click', '#connectionList .btn-edit', function (e) {
    e.preventDefault();
    const id = $(this).closest('[data-index]').data('index');
    loadConnectionData(id);
});

// $(document).on('click', '.toggle-topic-list', function (e) {
//     e.preventDefault();
// });

$(document).on('click', '.connect-server', function (e) {
    e.preventDefault();
    connIndex = $(this).closest('[data-index]').data('index');
    $(this).closest('.list-group-item').find('.server-topics').toggleClass("hidden");

    const topicList = $(this).closest('.list-group-item').find('.server-topics');
    topicList.empty();
    fetch(`/topics?connectionIndex=${connIndex}`)
        .then(response => response.json())
        .then(topics => {
            topics.forEach(topic => {
                topicList.append(`<li>
                    <button data-topic="${topic}">
                        <i class="far fa-fw fa-circle text-sm cursor-default"></i> ${topic}
                    </button>
                    </li>`);
            });
        })
        .catch(error => toastr.error(error.message || 'Failed to fetch topics'));

});

$(function () {

    loadConnectionList();

});
