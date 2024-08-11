function divTable(divSelector, headers) {
    // Determine the number of columns based on the length of the headers array
    const columns = headers.length;

    // Generate grid-template-columns dynamically based on the number of columns
    const gridTemplateColumns = `repeat(${columns}, 1fr)`;

    // Apply the styles to make columns dynamic
    let styles = `
    ${divSelector}:has(.div-table) {
        margin: 4px;
        flex-grow: 1;
        min-height: 1px;
        display: flex;
        flex-direction: column;
    }
    .div-table {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
    .div-table-header, .div-table-footer {
        display: grid;
        background-color: #3b82f6;
        color: white;
        padding: 2px;
        font-weight: bold;
    }
    .div-table-footer {
        background-color: #2980b9;
    }
    .div-table-body {
        flex-grow: 1;
        overflow-y: auto;
        background-color: #f8f9fa;
        padding: 2px;
    }
    .div-table-row {
        display: grid;
        border-bottom: 1px solid #ddd;
        transition: background 0.3s ease;
        padding: 2px 0;
    }
    .div-table-row:hover {
        background-color: #ecf0f1;
    }
    .div-table-col {
        padding: 2px;
    }
    .div-table-header, .div-table-row, .div-table-footer {
        grid-template-columns: ${gridTemplateColumns};
    }`;

    let styleElement = document.createElement('style');
    styleElement.innerText = styles;
    document.head.appendChild(styleElement);

    // Create table structure with dynamic headers
    let table = `<div class="div-table">
        <div class="div-table-header">
            ${headers.map(header => `<div class="div-table-col">${header}</div>`).join('')}
        </div>
        <div class="div-table-body"></div>
        <div class="div-table-footer" style="display: none">
            <div class="div-table-col div-table-colspan-${columns}">Footer</div>
        </div>
    </div>`;
    let tableElements = document.querySelectorAll(divSelector);
    tableElements.forEach(element => {
        element.insertAdjacentHTML('beforeend', table);
    })
}
