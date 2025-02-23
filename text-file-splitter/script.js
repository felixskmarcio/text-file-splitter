document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const loadFileBtn = document.getElementById('loadFileBtn');
    const clearFileBtn = document.getElementById('clearFileBtn');
    const splitButton = document.getElementById('splitButton');
    const splitNumber = document.getElementById('splitNumber');
    const characterSplit = document.getElementById('characterSplit');
    const lineSplit = document.getElementById('lineSplit');
    const utf8Radio = document.getElementById('utf8');
    const asciiRadio = document.getElementById('ascii');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    let selectedFile = null;
    let isProcessing = false;

    function updateProgress(percent, text) {
        if (progressBar) {
            progressBar.value = percent;
            progressBar.style.display = percent > 0 ? 'block' : 'none';
        }
        if (progressText) {
            progressText.textContent = text;
            progressText.style.display = text ? 'block' : 'none';
        }
    }

    function showError(message) {
        alert(message);
        updateProgress(0, '');
        isProcessing = false;
    }

    function updateFileInfo(file) {
        if (file) {
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileSize').textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
            document.querySelector('.file-info').classList.remove('hidden');
        } else {
            document.querySelector('.file-info').classList.add('hidden');
        }
    }

    function clearFileSelection() {
        selectedFile = null;
        fileInput.value = '';
        loadFileBtn.textContent = 'Carregar Arquivo';
        clearFileBtn.classList.add('hidden');
        updateFileInfo(null);
    }

    // Handle clear button click
    clearFileBtn.addEventListener('click', clearFileSelection);

    // Handle file selection
    loadFileBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        selectedFile = e.target.files[0];
        if (selectedFile) {
            loadFileBtn.textContent = selectedFile.name;
            clearFileBtn.classList.remove('hidden');
            updateFileInfo(selectedFile);

            // Check file size (500MB limit)
            if (selectedFile.size > 500 * 1024 * 1024) {
                alert('O arquivo excede o limite de 500MB');
                clearFileSelection();
            }
        }
    });

    async function handleExcelFile(buffer, numParts, fileExtension) {
        try {
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            // Remove empty rows
            const rows = data.filter(row => row.length > 0);
            
            if (rows.length === 0) {
                throw new Error('O arquivo Excel está vazio');
            }

            const headerRow = rows[0];
            const dataRows = rows.slice(1);
            const rowsPerPart = Math.ceil(dataRows.length / numParts);
            const parts = [];

            // Split the rows into parts
            for (let i = 0; i < numParts; i++) {
                const start = i * rowsPerPart;
                const end = Math.min(start + rowsPerPart, dataRows.length);
                const partRows = [headerRow, ...dataRows.slice(start, end)];
                
                // Create a new workbook for this part
                const partWorkbook = XLSX.utils.book_new();
                const partSheet = XLSX.utils.aoa_to_sheet(partRows);
                XLSX.utils.book_append_sheet(partWorkbook, partSheet, 'Sheet1');
                
                // Convert the workbook to a buffer
                const partBuffer = XLSX.write(partWorkbook, { type: 'array', bookType: fileExtension });
                parts.push(partBuffer);
            }

            return parts;
        } catch (error) {
            throw new Error(`Erro ao processar arquivo Excel: ${error.message}`);
        }
    }

    async function handleCSVFile(content, numParts) {
        try {
            const textContent = new TextDecoder(utf8Radio.checked ? 'utf-8' : 'ascii').decode(content);
            const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            if (lines.length === 0) {
                throw new Error('O arquivo CSV está vazio');
            }

            const headerRow = lines[0];
            const dataLines = lines.slice(1);
            const rowsPerPart = Math.ceil(dataLines.length / numParts);
            const parts = [];

            for (let i = 0; i < numParts; i++) {
                const start = i * rowsPerPart;
                const end = Math.min(start + rowsPerPart, dataLines.length);
                const partLines = [headerRow, ...dataLines.slice(start, end)];
                parts.push(new TextEncoder().encode(partLines.join('\n')));
            }

            return parts;
        } catch (error) {
            throw new Error(`Erro ao processar arquivo CSV: ${error.message}`);
        }
    }

    async function handleTextFile(content, numParts) {
        try {
            const textContent = new TextDecoder(utf8Radio.checked ? 'utf-8' : 'ascii').decode(content);
            const parts = [];

            if (characterSplit.checked) {
                const chunkSize = Math.ceil(textContent.length / numParts);
                for (let i = 0; i < numParts; i++) {
                    const start = i * chunkSize;
                    const end = Math.min(start + chunkSize, textContent.length);
                    parts.push(new TextEncoder().encode(textContent.slice(start, end)));
                }
            } else {
                const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                const linesPerPart = Math.ceil(lines.length / numParts);
                
                for (let i = 0; i < numParts; i++) {
                    const start = i * linesPerPart;
                    const end = Math.min(start + linesPerPart, lines.length);
                    parts.push(new TextEncoder().encode(lines.slice(start, end).join('\n')));
                }
            }

            return parts;
        } catch (error) {
            throw new Error(`Erro ao processar arquivo de texto: ${error.message}`);
        }
    }

    async function handleBinaryFile(content, numParts) {
        try {
            const parts = [];
            const chunkSize = Math.ceil(content.byteLength / numParts);
            
            for (let i = 0; i < numParts; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, content.byteLength);
                parts.push(content.slice(start, end));
            }

            return parts;
        } catch (error) {
            throw new Error(`Erro ao processar arquivo binário: ${error.message}`);
        }
    }

    // Handle file splitting
    splitButton.addEventListener('click', async () => {
        if (isProcessing) {
            return;
        }

        if (!selectedFile) {
            showError('Por favor, selecione um arquivo primeiro');
            return;
        }

        const numParts = parseInt(splitNumber.value);
        if (numParts < 2) {
            showError('Por favor, insira um número maior que 1');
            return;
        }

        isProcessing = true;
        updateProgress(10, 'Lendo arquivo...');

        const reader = new FileReader();
        
        reader.onerror = () => {
            showError('Erro ao ler o arquivo. Verifique se o arquivo não está corrompido.');
        };

        reader.onload = async (e) => {
            try {
                updateProgress(30, 'Processando arquivo...');
                const content = e.target.result;
                const fileName = selectedFile.name;
                const fileExtension = fileName.split('.').pop().toLowerCase();
                const baseFileName = fileName.slice(0, -(fileExtension.length + 1));
                let parts = [];

                // Handle different file types
                if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                    parts = await handleExcelFile(content, numParts, fileExtension);
                } else if (fileExtension === 'csv') {
                    parts = await handleCSVFile(content, numParts);
                } else if (/^(txt|log|text|dat|json|xml|html|htm|css|js|md)$/i.test(fileExtension)) {
                    parts = await handleTextFile(content, numParts);
                } else {
                    parts = await handleBinaryFile(content, numParts);
                }

                // Create ZIP file containing all split files
                updateProgress(60, 'Criando arquivo ZIP...');
                const zip = new JSZip();

                // Add each part to the ZIP file
                parts.forEach((part, index) => {
                    updateProgress(
                        60 + Math.floor((index + 1) / parts.length * 20),
                        `Adicionando parte ${index + 1} de ${parts.length}...`
                    );
                    zip.file(`${baseFileName}_parte${index + 1}.${fileExtension}`, part);
                });

                // Generate and download the ZIP file
                updateProgress(80, 'Gerando arquivo ZIP...');
                const zipOptions = { 
                    type: "blob",
                    compression: "DEFLATE",
                    compressionOptions: {
                        level: 6
                    }
                };

                const zipContent = await zip.generateAsync(zipOptions);
                
                updateProgress(90, 'Baixando arquivo...');
                const downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(zipContent);
                downloadLink.download = `${baseFileName}_arquivos_divididos.zip`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(downloadLink.href);
                
                updateProgress(100, 'Concluído!');
                setTimeout(() => {
                    updateProgress(0, '');
                    isProcessing = false;
                }, 2000);
            } catch (error) {
                showError(error.message);
            }
        };

        // Read file as ArrayBuffer to handle both text and binary files
        reader.readAsArrayBuffer(selectedFile);
    });

    // Add drag and drop functionality
    const uploadArea = document.querySelector('.upload-area');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.style.borderColor = '#000';
            uploadArea.style.backgroundColor = '#f0f0f0';
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.style.borderColor = '#ccc';
            uploadArea.style.backgroundColor = '#f8f8f8';
        });
    });

    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        
        if (file) {
            fileInput.files = dt.files;
            const event = new Event('change');
            fileInput.dispatchEvent(event);
        }
    });
});
