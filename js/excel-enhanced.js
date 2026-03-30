class ExcelEnhanced {
    constructor() {
        this.sheets = [];
        this.currentSheetIndex = 0;
        this.clipboard = null;
        this.selectedCells = new Set();
        this.activeCell = null;
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;

        this.ROWS = 100;
        this.COLS = 26;

        this.init();
    }

    init() {
        this.createSheet('Основная');
        this.render();
        this.attachEventListeners();
        this.loadData();
    }

    createSheet(name) {
        const sheet = {
            name: name,
            data: this.createEmptyData()
        };
        this.sheets.push(sheet);
        return sheet;
    }

    createEmptyData() {
        const data = {};
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const key = `${r}_${c}`;
                data[key] = '';
            }
        }
        return data;
    }

    getCurrentSheet() {
        return this.sheets[this.currentSheetIndex];
    }

    getColumnName(index) {
        let name = '';
        while (index >= 0) {
            name = String.fromCharCode(65 + (index % 26)) + name;
            index = Math.floor(index / 26) - 1;
        }
        return name;
    }

    render() {
        this.renderTable();
        this.renderTabs();
    }

    renderTable() {
        const thead = document.getElementById('tableHead');
        const tbody = document.getElementById('tableBody');
        const sheet = this.getCurrentSheet();

        // Рендер заголовка
        let headerHTML = '<tr><th class="corner-cell"></th>';
        for (let c = 0; c < this.COLS; c++) {
            headerHTML += `<th class="col-header" data-col="${c}">${this.getColumnName(c)}</th>`;
        }
        headerHTML += '</tr>';
        thead.innerHTML = headerHTML;

        // Рендер тела таблицы
        let bodyHTML = '';
        for (let r = 0; r < this.ROWS; r++) {
            bodyHTML += '<tr>';
            bodyHTML += `<th class="row-header" data-row="${r}">${r + 1}</th>`;

            for (let c = 0; c < this.COLS; c++) {
                const key = `${r}_${c}`;
                const value = sheet.data[key] || '';
                bodyHTML += `
                    <td class="data-cell" data-row="${r}" data-col="${c}" data-key="${key}">
                        <input type="text" class="cell-input" value="${this.escapeHtml(value)}" />
                    </td>
                `;
            }
            bodyHTML += '</tr>';
        }
        tbody.innerHTML = bodyHTML;

        // Подключаем обработчики к ячейкам
        this.attachCellListeners();
    }

    renderTabs() {
        const container = document.getElementById('tabsContainer');

        container.innerHTML = this.sheets.map((sheet, index) => `
            <div class="sheet-tab ${index === this.currentSheetIndex ? 'active' : ''}" data-index="${index}">
                <span>${sheet.name}</span>
                ${this.sheets.length > 1 ? '<span class="tab-close">×</span>' : ''}
            </div>
        `).join('');

        // Обработчики для вкладок
        container.querySelectorAll('.sheet-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-close')) {
                    this.deleteSheet(parseInt(tab.dataset.index));
                } else {
                    this.switchSheet(parseInt(tab.dataset.index));
                }
            });

            tab.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showTabContextMenu(e, parseInt(tab.dataset.index));
            });
        });
    }

    attachCellListeners() {
        const cells = document.querySelectorAll('.data-cell');

        cells.forEach(cell => {
            const input = cell.querySelector('.cell-input');

            // Изменение значения
            input.addEventListener('input', () => {
                const key = cell.dataset.key;
                this.getCurrentSheet().data[key] = input.value;
                this.saveData();
            });

            // Фокус
            input.addEventListener('focus', () => {
                this.activeCell = cell;
                this.highlightRowCol(cell);
            });

            // Навигация клавиатурой
            input.addEventListener('keydown', (e) => {
                this.handleCellNavigation(e, cell);
            });

            // Выделение мышью
            cell.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // Левая кнопка
                    this.startSelection(cell, e);
                }
            });

            cell.addEventListener('mouseenter', () => {
                if (this.isSelecting) {
                    this.updateSelection(cell);
                }
            });

            // Контекстное меню
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e, cell);
            });
        });

        // Выбор строки/столбца
        document.querySelectorAll('.row-header').forEach(header => {
            header.addEventListener('click', () => {
                this.selectRow(parseInt(header.dataset.row));
            });
        });

        document.querySelectorAll('.col-header').forEach(header => {
            header.addEventListener('click', () => {
                this.selectColumn(parseInt(header.dataset.col));
            });
        });
    }

    handleCellNavigation(e, cell) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const input = cell.querySelector('.cell-input');

        let newRow = row;
        let newCol = col;

        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                newRow = Math.min(row + 1, this.ROWS - 1);
                break;
            case 'Tab':
                e.preventDefault();
                if (e.shiftKey) {
                    newCol = Math.max(col - 1, 0);
                } else {
                    newCol = Math.min(col + 1, this.COLS - 1);
                }
                break;
            case 'ArrowUp':
                if (input.selectionStart === 0 && input.selectionEnd === 0) {
                    e.preventDefault();
                    newRow = Math.max(row - 1, 0);
                }
                break;
            case 'ArrowDown':
                if (input.selectionStart === input.value.length) {
                    e.preventDefault();
                    newRow = Math.min(row + 1, this.ROWS - 1);
                }
                break;
            case 'ArrowLeft':
                if (input.selectionStart === 0) {
                    e.preventDefault();
                    newCol = Math.max(col - 1, 0);
                }
                break;
            case 'ArrowRight':
                if (input.selectionStart === input.value.length) {
                    e.preventDefault();
                    newCol = Math.min(col + 1, this.COLS - 1);
                }
                break;
        }

        if (newRow !== row || newCol !== col) {
            const newCell = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
            if (newCell) {
                newCell.querySelector('.cell-input').focus();
            }
        }
    }

    startSelection(cell, e) {
        if (!e.shiftKey) {
            this.clearSelection();
            this.selectionStart = cell;
            this.selectionEnd = cell;
            cell.classList.add('selected');
            this.selectedCells.add(cell);
        }
        this.isSelecting = true;
    }

    updateSelection(endCell) {
        if (!this.selectionStart) return;

        this.clearSelection();
        this.selectionEnd = endCell;

        const startRow = parseInt(this.selectionStart.dataset.row);
        const startCol = parseInt(this.selectionStart.dataset.col);
        const endRow = parseInt(endCell.dataset.row);
        const endCol = parseInt(endCell.dataset.col);

        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const cell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('selected');
                    this.selectedCells.add(cell);
                }
            }
        }
    }

    clearSelection() {
        this.selectedCells.forEach(cell => {
            cell.classList.remove('selected', 'selecting');
        });
        this.selectedCells.clear();
    }

    selectRow(rowIndex) {
        this.clearSelection();
        for (let c = 0; c < this.COLS; c++) {
            const cell = document.querySelector(`[data-row="${rowIndex}"][data-col="${c}"]`);
            if (cell) {
                cell.classList.add('selected');
                this.selectedCells.add(cell);
            }
        }
    }

    selectColumn(colIndex) {
        this.clearSelection();
        for (let r = 0; r < this.ROWS; r++) {
            const cell = document.querySelector(`[data-row="${r}"][data-col="${colIndex}"]`);
            if (cell) {
                cell.classList.add('selected');
                this.selectedCells.add(cell);
            }
        }
    }

    highlightRowCol(cell) {
        document.querySelectorAll('.row-header, .col-header').forEach(h => {
            h.classList.remove('selected');
        });

        const row = cell.dataset.row;
        const col = cell.dataset.col;

        document.querySelector(`.row-header[data-row="${row}"]`).classList.add('selected');
        document.querySelector(`.col-header[data-col="${col}"]`).classList.add('selected');
    }

    // Операции с данными
    copy() {
        this.clipboard = [];
        this.selectedCells.forEach(cell => {
            const key = cell.dataset.key;
            this.clipboard.push({
                key: key,
                value: this.getCurrentSheet().data[key] || ''
            });
        });
        this.showToast('Скопировано', 'success');
    }

    paste() {
        if (!this.clipboard || !this.activeCell) return;

        const startRow = parseInt(this.activeCell.dataset.row);
        const startCol = parseInt(this.activeCell.dataset.col);

        // Определяем размеры копируемой области
        const clipboardCells = this.clipboard.map(item => {
            const [r, c] = item.key.split('_').map(Number);
            return { row: r, col: c, value: item.value };
        });

        const minRow = Math.min(...clipboardCells.map(c => c.row));
        const minCol = Math.min(...clipboardCells.map(c => c.col));

        // Вставляем данные
        clipboardCells.forEach(item => {
            const offsetRow = item.row - minRow;
            const offsetCol = item.col - minCol;
            const targetRow = startRow + offsetRow;
            const targetCol = startCol + offsetCol;

            if (targetRow < this.ROWS && targetCol < this.COLS) {
                const targetKey = `${targetRow}_${targetCol}`;
                this.getCurrentSheet().data[targetKey] = item.value;

                const targetCell = document.querySelector(`[data-key="${targetKey}"]`);
                if (targetCell) {
                    targetCell.querySelector('.cell-input').value = item.value;
                }
            }
        });

        this.saveData();
        this.showToast('Вставлено', 'success');
    }

    cut() {
        this.copy();
        this.selectedCells.forEach(cell => {
            const key = cell.dataset.key;
            this.getCurrentSheet().data[key] = '';
            cell.querySelector('.cell-input').value = '';
        });
        this.saveData();
        this.showToast('Вырезано', 'success');
    }

    deleteSelection() {
        this.selectedCells.forEach(cell => {
            const key = cell.dataset.key;
            this.getCurrentSheet().data[key] = '';
            cell.querySelector('.cell-input').value = '';
        });
        this.saveData();
        this.showToast('Удалено', 'success');
    }

    // Операции со строками и столбцами
    insertRow(position, referenceRow) {
        const sheet = this.getCurrentSheet();
        const newData = {};

        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const oldKey = `${r}_${c}`;
                let newRow = r;

                if (position === 'above' && r >= referenceRow) {
                    newRow = r + 1;
                } else if (position === 'below' && r > referenceRow) {
                    newRow = r + 1;
                }

                const newKey = `${newRow}_${c}`;
                if (newRow < this.ROWS) {
                    newData[newKey] = sheet.data[oldKey] || '';
                }
            }
        }

        // Очищаем новую строку
        const insertedRow = position === 'above' ? referenceRow : referenceRow + 1;
        for (let c = 0; c < this.COLS; c++) {
            newData[`${insertedRow}_${c}`] = '';
        }

        sheet.data = newData;
        this.render();
        this.saveData();
        this.showToast('Строка добавлена', 'success');
    }

    deleteRow(rowIndex) {
        const sheet = this.getCurrentSheet();
        const newData = {};

        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                let sourceRow = r;
                if (r > rowIndex) {
                    sourceRow = r + 1;
                } else if (r === rowIndex) {
                    continue;
                }

                const sourceKey = `${sourceRow}_${c}`;
                const targetKey = `${r}_${c}`;
                newData[targetKey] = sheet.data[sourceKey] || '';
            }
        }

        sheet.data = newData;
        this.render();
        this.saveData();
        this.showToast('Строка удалена', 'success');
    }

    // Вкладки
    switchSheet(index) {
        this.currentSheetIndex = index;
        this.render();
    }

    deleteSheet(index) {
        if (this.sheets.length <= 1) {
            this.showToast('Нельзя удалить последний лист', 'error');
            return;
        }

        if (confirm(`Удалить лист "${this.sheets[index].name}"?`)) {
            this.sheets.splice(index, 1);
            if (this.currentSheetIndex >= this.sheets.length) {
                this.currentSheetIndex = this.sheets.length - 1;
            }
            this.render();
            this.saveData();
            this.showToast('Лист удален', 'success');
        }
    }

    addSheet() {
        const modal = document.getElementById('sheetModal');
        const input = document.getElementById('sheetNameInput');

        input.value = `Лист ${this.sheets.length + 1}`;
        modal.classList.add('active');
        input.focus();
        input.select();
    }

    // Контекстное меню
    showContextMenu(e, cell) {
        const menu = document.getElementById('contextMenu');
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        menu.classList.add('active');

        this.contextMenuTarget = cell;
    }

    hideContextMenu() {
        document.getElementById('contextMenu').classList.remove('active');
    }

    // Экспорт
    exportToCSV() {
        const sheet = this.getCurrentSheet();
        let csv = '';

        // Заголовки
        csv += ',';
        for (let c = 0; c < this.COLS; c++) {
            csv += this.getColumnName(c);
            if (c < this.COLS - 1) csv += ',';
        }
        csv += '\n';

        // Данные
        for (let r = 0; r < this.ROWS; r++) {
            csv += `${r + 1},`;
            for (let c = 0; c < this.COLS; c++) {
                const value = sheet.data[`${r}_${c}`] || '';
                // Экранируем значения с запятыми и кавычками
                if (value.includes(',') || value.includes('"')) {
                    csv += `"${value.replace(/"/g, '""')}"`;
                } else {
                    csv += value;
                }
                if (c < this.COLS - 1) csv += ',';
            }
            csv += '\n';
        }

        // Скачиваем файл
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${sheet.name}.csv`;
        link.click();

        this.showToast('Экспортировано', 'success');
    }

    // Сохранение/загрузка
    saveData() {
        const data = {
            sheets: this.sheets,
            currentSheetIndex: this.currentSheetIndex
        };
        localStorage.setItem('excelData', JSON.stringify(data));
    }

    loadData() {
        const saved = localStorage.getItem('excelData');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.sheets = data.sheets || [];
                this.currentSheetIndex = data.currentSheetIndex || 0;

                if (this.sheets.length === 0) {
                    this.createSheet('Основная');
                }

                this.render();
            } catch (e) {
                console.error('Ошибка загрузки:', e);
            }
        }
    }

    // Утилиты
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Обработчики событий
    attachEventListeners() {
        // Кнопки в шапке
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveData();
            this.showToast('Сохранено', 'success');
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportToCSV();
        });

        // Добавление листа
        document.getElementById('addSheetBtn').addEventListener('click', () => {
            this.addSheet();
        });

        // Модальное окно
        const modal = document.getElementById('sheetModal');
        const modalConfirm = document.getElementById('modalConfirm');
        const modalCancel = document.getElementById('modalCancel');
        const sheetNameInput = document.getElementById('sheetNameInput');

        modalConfirm.addEventListener('click', () => {
            const name = sheetNameInput.value.trim();
            if (name) {
                this.createSheet(name);
                this.currentSheetIndex = this.sheets.length - 1;
                this.render();
                this.saveData();
                modal.classList.remove('active');
                this.showToast('Лист создан', 'success');
            }
        });

        modalCancel.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        sheetNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                modalConfirm.click();
            }
        });

        // Контекстное меню
        const contextMenu = document.getElementById('contextMenu');

        contextMenu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleContextAction(action);
                this.hideContextMenu();
            });
        });

        // Закрытие контекстного меню
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // Завершение выделения
        document.addEventListener('mouseup', () => {
            this.isSelecting = false;
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'c':
                        e.preventDefault();
                        this.copy();
                        break;
                    case 'v':
                        e.preventDefault();
                        this.paste();
                        break;
                    case 'x':
                        e.preventDefault();
                        this.cut();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveData();
                        this.showToast('Сохранено', 'success');
                        break;
                    case 'a':
                        e.preventDefault();
                        this.selectAll();
                        break;
                }
            } else if (e.key === 'Delete') {
                this.deleteSelection();
            }
        });
    }

    handleContextAction(action) {
        const cell = this.contextMenuTarget;
        if (!cell) return;

        const row = parseInt(cell.dataset.row);

        switch (action) {
            case 'copy':
                this.copy();
                break;
            case 'paste':
                this.paste();
                break;
            case 'cut':
                this.cut();
                break;
            case 'delete':
                this.deleteSelection();
                break;
            case 'insertRowAbove':
                this.insertRow('above', row);
                break;
            case 'insertRowBelow':
                this.insertRow('below', row);
                break;
            case 'deleteRow':
                this.deleteRow(row);
                break;
            case 'insertColLeft':
                this.showToast('Функция в разработке', 'error');
                break;
            case 'insertColRight':
                this.showToast('Функция в разработке', 'error');
                break;
            case 'deleteCol':
                this.showToast('Функция в разработке', 'error');
                break;
        }
    }

    selectAll() {
        this.clearSelection();
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const cell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('selected');
                    this.selectedCells.add(cell);
                }
            }
        }
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    new ExcelEnhanced();
});