/**
 * Mini JQuery
 */
function $$(selector, node) {
    return (node || document).querySelector(selector);
}

const MEMORY_SIZE = 256;


function toBinStr(integer, lenght) {
    var str = "";
    for (lenght--; lenght >= 0; lenght--) {
        str += + ((integer >> lenght) & 1);
    }
    return str;
}

function toHexStr(integer, lenght) {
    const HEX_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
    var str = "";
    for (var i = (lenght - 1) * 4; i >= 0; i -= 4) {
        str += HEX_CHARS[((integer >> i) & 0xF)];
    }
    return str;
}

function strToNum(str, length, radix) {
    if (str.length != length) return null;
    var start = 0;
    for (; start < length - 1; start++) {
        if (str[start] != '0') break;
    }
    var res = parseInt(str.substring(start, length), radix ? radix : 2);
    return isNaN(res) ? null : res;
}


function Core() {
    var self = this;

    const COMMAND_ASM = [
        'HLT',
        'RUN',
        'RET',
        'LDA',
        'STA',
        'JES',
        'JEZ',
        'JMP',
        'ADD',
        'SUB',
        'MUL',
        'DIV',
        'AND',
        'OR',
        'XOR',
        'INC'
    ];

    var oldEdit, table, tableBase, tableMemory;
    function endEdit() {
        if (oldEdit) {
            var addr = oldEdit.parentNode.rowIndex;
            var offs = oldEdit.parentNode.parentNode.offsetAddr;
            oldEdit.verifyEdit(oldEdit.innerText = $$('input', oldEdit).value, addr + offs);
            oldEdit.parentNode.classList.remove('select-line');
        }
    }

    function selectEdit(event) {
        var cell = event.target;
        if (!cell.classList.contains('dat')) return;
        endEdit();
        oldEdit = cell;
        cell.parentNode.classList.add('select-line');
        var input = document.createElement('input');
        input.type = 'text';
        input.value = cell.innerText;
        cell.innerHTML = '';
        input.style.width = (cell.offsetWidth ||
            cell.getBoundingClientRect().width) + 'px';
        input.addEventListener('keypress', (e) => {
            if (e.keyCode == 13) {
                endEdit();
                oldEdit = null;
            }
        });
        cell.appendChild(input);
        //input.dispatchEvent(e);
        event.stopPropagation();
        return input;
    }

    function setMemory(addr, value) {
        value &= 0xFFF;
        self.memory[addr] = value;
        var cells;
        //
        if (addr < 9 || addr >= 200) {
            var t;
            if (addr >= 200) {
                addr -= 200;
                t = tableMemory;
            } else t = tableBase;
            //
            cells = t.rows[addr].cells;
            cells[1].textContent = toBinStr(value, 12);
            cells[2].textContent = toHexStr(value, 3);
            if ((value & 0x800) != 0) {
                value |= -1 ^ 0xFFF;
            }
            cells[3].textContent = + value;
        } else {
            addr -= 9;
            var code = value & 0xF;
            cells = table.rows[addr].cells;
            cells[1].textContent = toBinStr(code, 4);
            cells[2].textContent = COMMAND_ASM[code];
            cells[3].textContent = (value >> 4) & 1;
            cells[4].textContent = toBinStr(value >> 5, 3);
            cells[5].textContent = toBinStr(value >> 8, 4);
        }

    }

    function verifyOpCode(value, addr) {
        var code = strToNum(value, 4);
        if (code == null) return false;
        setMemory(addr, code | (self.memory[addr] & (0xFF0)));
        return true;
    }

    function verifyAsm(value, addr) {
        value = value.toUpperCase();
        var code = COMMAND_ASM.indexOf(value);
        if (code == -1) return false;
        setMemory(addr, code | (self.memory[addr] & (0xFF0)));
        return true;
    }

    function verifyR(value, addr) {
        var code = strToNum(value, 1);
        if (code == null) return false;
        setMemory(addr, (code << 4) | (self.memory[addr] & (0xFEF)));
        return true;
    }

    function verifyB(value, addr) {
        var code = strToNum(value, 3);
        if (code == null) return false;
        setMemory(addr, (code << 5) | (self.memory[addr] & (0xF1F)));
        return true;
    }

    function verifyD(value, addr) {
        var code = strToNum(value, 4);
        if (code == null) return false;
        setMemory(addr, (code << 8) | (self.memory[addr] & (0x0FF)));
        return true;
    }

    function verifyBinary(value, addr) {
        var code = strToNum(value, 12);
        if (code == null) return false;
        setMemory(addr, code);
        return true;
    }

    function verifyHex(value, addr) {
        var code = strToNum(value, 3, 16);
        if (code == null) return false;
        setMemory(addr, code);
        return true;
    }

    function verifyDecemical(value, addr) {
        var code = parseInt(value);
        if (isNaN(code)) return false;
        setMemory(addr, code);
        return true;
    }

    this.reset = () => {
        this.pause();
        self.regs.R1.set(0);
        self.regs.R2.set(0);
        self.regs.RS.set(0);
        self.regs.RK.set(0);
        self.regs.RA.set(0);
        self.regs.SAK.set(9);
        self.flags.S.checked = false;
        self.flags.Z.checked = false;
        self.flags.C.checked = false;
        self.flags.E.checked = false;
    };

    this.init = () => {
        table = $$('tbody', $$('#commands-list'));
        tableBase = $$('tbody', $$('#base-list'));
        tableMemory = $$('tbody', $$('#memory-list'));
        //
        table.offsetAddr = 8;
        tableBase.offsetAddr = -1;
        tableMemory.offsetAddr = 199;
        self.memory = [];
        //
        function createCell(index, verifyFunc) {
            var cell = row.insertCell(index);
            cell.verifyEdit = (value, addr) => {
                if (verifyFunc && !verifyFunc(value, addr)) {
                    cell.classList.add('error');
                } else {
                    cell.classList.remove('error');
                }
            };
            cell.classList.add('dat');
        }
        //
        var addr = 0;
        for (; addr < 9; addr++) {
            var row = tableBase.insertRow(addr);
            // Адрес
            row.insertCell(0).innerText = addr;
            // Binary
            createCell(1, verifyBinary);
            // Hex
            createCell(2, verifyHex);
            // Decemical
            createCell(3, verifyDecemical);
            setMemory(addr, 0);
        }
        //
        for (; addr < 200; addr++) {
            var row = table.insertRow(addr - 9);
                // Адрес
            row.insertCell(0).innerText = addr;
                // Код команды
            createCell(1, verifyOpCode);
                // Мнемоника команды
            createCell(2, verifyAsm);
                // R
            createCell(3, verifyR);
                // B
            createCell(4, verifyB);
                // D
            createCell(5, verifyD);
        }
        //
        for (; addr < MEMORY_SIZE; addr++) {
            row = tableMemory.insertRow(addr - 200);
            row.insertCell(0).innerText = addr;
            // Binary
            createCell(1, verifyBinary);
            // Hex
            createCell(2, verifyHex);
            // Decemical
            createCell(3, verifyDecemical);
            setMemory(addr, 0);
        }
        //
        for (var i = 0; i < 8; i++) {
            tableBase.rows[i].classList.add('base-addr');
        }
        table.addEventListener('mousedown', selectEdit);
        tableMemory.addEventListener('mousedown', selectEdit);
        //
        self.regs = {
            R1: $$('#reg-R1'),
            R2: $$('#reg-R2'),
            RA: $$('#reg-RA'),
            RS: $$('#reg-RS'),
            RK: $$('#reg-RK')
        };
        //
        for (var indx in self.regs) {
            var reg = self.regs[indx];
            reg.capacity = 12;
            reg.get = function () {
                var value = strToNum(this.value, this.capacity);
                if (value == null) {
                    this.classList.add('error');
                    return 0;
                }
                this.classList.remove('error');
                return value;
            };
            reg.set = function (value) {
                this.classList.remove('error');
                this.value = toBinStr(value, this.capacity)
            };
            reg.addEventListener('change', (e) => {
                e.target.get();
            });
        }
        //
        self.regs.SAK = $$('#reg-SAK')
        var baseSettter = self.regs.R1.set;
        self.regs.SAK.get = self.regs.R1.get;
        var oldAddr;
        self.regs.SAK.set = function (value) {
            value &= 0xFF;
            baseSettter.call(this, value);
            if (oldAddr) table.rows[oldAddr].classList.remove('run-line');
            if (value >= 9 && value < 200) {
                value -= 9;
                oldAddr = value;
                table.rows[value].classList.add('run-line');
            } else {
                oldAddr = null;
            }
        };
        self.regs.SAK.addEventListener('change', (e) => {
            var addr = e.target.get();
            if (!e.target.classList.contains('error')) {
                e.target.set(addr);
            }
        });
        //
        self.regs.RA.capacity = 8;
        self.regs.SAK.capacity = 8;
        //
        self.flags = {
            S: $$('#flag-S'),
            Z: $$('#flag-Z'),
            C: $$('#flag-C'),
            E: $$('#flag-E')
        };
        //
        self.reset();
    };

    function setACC(R, value) {
        (R ? self.regs.R2 : self.regs.R1).set(value);
    }

    function getACC(R) {
        return (R ? self.regs.R2 : self.regs.R1).get();
    }

    var timer = null;

    const COMMAND_EXEC = [
        (R) => { // HLT
            this.pause();
            this.regs.SAK.set(this.regs.SAK.get() - 1);
        },
        (R) => { // RUN
            setMemory(8, this.regs.SAK.get());
            self.regs.SAK.set(this.regs.RA.get());
        },
        (R) => { // RET
            self.regs.SAK.set(this.memory[8]);
        },
        (R) => { // LDA
            setACC(R, self.memory[self.regs.RA.get()]);
        },
        (R) => { // SDA
            setMemory(self.regs.RA.get(), getACC((R)));
        },
        (R) => { // JES
            if (this.flags.S.checked) {
                self.regs.SAK.set(this.regs.RA.get());
            }
        },
        (R) => { // JEZ
            if (this.flags.Z.checked) {
                self.regs.SAK.set(this.regs.RA.get());
            }
        },
        (R) => { // JMP
            self.regs.SAK.set(this.regs.RA.get());
        },
        (R) => { // ADD
            var res = getACC(R) + self.memory[self.regs.RA.get()];
            this.flags.Z.checked = (res & 0xFFF) == 0;
            this.flags.S.checked = (res & 0x800) != 0;
            this.flags.C.checked = (res & (-1 ^ 0xFFF)) != 0;
            setACC(R, res);
        },
        (R) => { // SUB
            var res = getACC(R) - self.memory[self.regs.RA.get()];
            this.flags.Z.checked = (res & 0xFFF) == 0;
            this.flags.S.checked = (res & 0x800) != 0;
            this.flags.C.checked = (res & (-1 ^ 0xFFF)) != 0;
            setACC(R, res);
        },
        (R) => { // MUL
            var res = getACC(R) * self.memory[self.regs.RA.get()];
            this.flags.Z.checked = (res & 0xFFF) == 0;
            this.flags.S.checked = (res & 0x800) != 0;
            this.flags.C.checked = (res & (-1 ^ 0xFFF)) != 0;
            setACC(R, res);
        },
        (R) => { // DIV
            var op = self.memory[self.regs.RA.get()];
            if (op != 0) {
                var res = getACC(R) / op;
                this.flags.Z.checked = (res & 0xFFF) == 0;
                this.flags.S.checked = (res & 0x800) != 0;
                this.flags.C.checked = (res & (-1 ^ 0xFFF)) != 0;
                setACC(R, res);
            } else {
                console.log('Error! Divizion by zero!');
            }
        },
        (R) => { // AND
            var res = getACC(R) & self.memory[self.regs.RA.get()];
            this.flags.Z.checked = (res & 0xFFF) == 0;
            this.flags.S.checked = (res & 0x800) != 0;
            setACC(R, res);
        },
        (R) => { // OR
            var res = getACC(R) | self.memory[self.regs.RA.get()];
            this.flags.Z.checked = (res & 0xFFF) == 0;
            this.flags.S.checked = (res & 0x800) != 0;
            setACC(R, res);
        },
        (R) => { // XOR
            var res = getACC(R) ^ self.memory[self.regs.RA.get()];
            this.flags.Z.checked = (res & 0xFFF) == 0;
            this.flags.S.checked = (res & 0x800) != 0;
            setACC(R, res);
        },
        (R) => { // INC
            var addr = self.regs.RA.get();
            var value = self.memory[addr];
            value = (value + 1) & 0xFFF;
            setMemory(addr, value);
            if (this.flags.E.checked = (value == 0)) {
                self.regs.SAK.set(self.regs.SAK.get() + 1);
            }
        },
    ];

    this.step = () => {
        var SAK = self.regs.SAK.get();
        var RK = self.memory[SAK];
        self.regs.RK.set(RK);
        var R = (RK & 0x10) != 0;
        var B = (RK >> 5) & 7;
        var D = (RK >> 8) & 0xF;
        self.regs.RA.set(self.memory[B] + D);
        self.regs.SAK.set(SAK + 1);
        //
        COMMAND_EXEC[RK & 0xF](R);
    }

    this.run = (delay) => {
        if (timer == null) {
            timer = setInterval(this.step, delay);
        }
    };

    this.pause = () => {
        if (timer) clearInterval(timer);
        timer = null;
    }

    this.upload = () => {
        var a = document.createElement("a");
        var file = new Blob([JSON.stringify(this.memory)], {type: 'text/plain'});
        a.href = URL.createObjectURL(file);
        a.download = name;
        a.click();
    };

    this.load = (file) => {
        var fileReader = new FileReader();
        fileReader.onload = (e) => {
            var dump = JSON.parse(e.target.result);
            for (var addr = 0; addr < MEMORY_SIZE; addr++) {
                setMemory(addr, dump[addr]);
            }
        };
        fileReader.readAsText(file);
    };
}

var core;

window.addEventListener("load", () => {
    $$('#com-but').addEventListener('click', (e) => {
        e.target.classList.add('select-tab');
        $$('#mem-but').classList.remove('select-tab');
        $$('#base-but').classList.remove('select-tab');
        $$('#command-observer').style.display = 'inline-block';
        $$('#base-observer').style.display = 'none';
        $$('#memory-observer').style.display = 'none';
    });
    $$('#base-but').addEventListener('click', (e) => {
        e.target.classList.add('select-tab');
        $$('#mem-but').classList.remove('select-tab');
        $$('#com-but').classList.remove('select-tab');
        $$('#command-observer').style.display = 'none';
        $$('#base-observer').style.display = 'inline-block';
        $$('#memory-observer').style.display = 'none';
    });
    $$('#mem-but').addEventListener('click', (e) => {
        e.target.classList.add('select-tab');
        $$('#com-but').classList.remove('select-tab');
        $$('#base-but').classList.remove('select-tab');
        $$('#command-observer').style.display = 'none';
        $$('#base-observer').style.display = 'none';
        $$('#memory-observer').style.display = 'inline-block';
    });
    core = new Core();
    core.init();
    //
    $$('#but-run').addEventListener('click', () => {
        core.run(+ $$("#inp-delay").value);
    });
    $$('#but-pause').addEventListener('click', core.pause);
    $$('#but-reset').addEventListener('click', core.reset);
    $$('#but-step').addEventListener('click', core.step);
    //
    $$('#upload-file').addEventListener('click', core.upload);
    $$('#load-file').addEventListener('change', (e) => {
        core.load(e.target.files[0]);
    })
});
