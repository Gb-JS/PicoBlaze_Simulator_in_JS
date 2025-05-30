const tree = require("../TreeNode.js");
global.TreeNode = tree.TreeNode; // referenced by tokenizer

const tokenizer =
    require("../tokenizer.js"); // Parser depends on the tokenizer to work...

const list_of_directives = require(
    "../list_of_directives.js"); //...as well as on the list of directives.
global.mnemonics = list_of_directives.mnemonics;
global.preprocessor = list_of_directives.preprocessor;

const parser = require("../parser.js");

const preprocessor = require("../preprocessor.js");

const headerScript = require("../headerScript.js");
global.machineCode = headerScript.machineCode;
global.formatAsAddress =
    headerScript.formatAsAddress; // Or else labels won't work.

global.default_base_of_literals_in_assembly = 16;

const assembler = require("../assembler.js");

describe("Assembler tests", () => {
  test("`inst` works", () => {
    const assembly = `
address 0
inst 1 + 2 * 3
`;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[0].hex).toBe("00007");
  });

  test("Loading a constant into a register works", () => {
    const assembly = `
address 0
load s1, (1 + 2) * 3
`;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[0].hex).toBe("01109");
  });

  test("Moving values between registers works", () => {
    const assembly = `
address 0
load s0, s1
`;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[0].hex).toBe("00010");
  });

  test("Labels work", () => {
    const assembly = `
address 0
jump label
load s0, 1
label:
add s0, s0
`;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[0].hex).toBe("22002");
  });

  test("Pointers and namereg work", () => {
    const assembly = `
address 0
namereg sf, pointer
store s0, (pointer)
`;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[0].hex).toBe("2e0f0");
  });

  test("Conditional jumps work", () => {
    const assembly = `
address 0
input s0, 0
compare s0, 200'd
jump c, less_than_200
sub s0, 200'd
load s1, 2
less_than_200:
compare s0, 100'd
`;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[2].hex).toBe("3a005");
  });

  test("Changing the bases of the constant literals works", () => {
    const assembly = `
		address 0
		inst 10
		base_decimal
		inst 10
		base_hexadecimal
		inst 10
		`;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[0].hex).toBe("00010");
    expect(machineCode[1].hex).toBe("0000a");
    expect(machineCode[2].hex).toBe("00010");
  });
  
  test("Function pointers are assembled correctly", () => {
    const assembly = `
address 0
call@(s1, s2)
`;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[0].hex).toBe("24120");
  });

  test("The ternary conditional operator inside JUMP works correctly", () => { // This was once crashing the assembler: https://github.com/FlatAssembler/PicoBlaze_Simulator_in_JS/issues/38
    const assembly = `
;This is an example program demonstrating
;how the \`?:\` operator in jumps, supposedly
;enabled in v5.2.1, doesn't really work as
;intended.

address 0
jump PicoBlaze_Simulator_in_JS ? code_that_should_run_in_browser : code_that_should_run_on_mobile
load s0, 0
code_that_should_run_on_mobile:
load s0, 1
jump end_of_branching
code_that_should_run_in_browser:
load s0, 2
jump end_of_branching
end_of_branching:

;The 7th line doesn't assemble. The assembler
;asks the user \`Instead of 
;"code_that_should_run_in_browser", in the
;line #7, did you perhaps mean 
;"PicoBlaze_Simulator_in_JS"?\`. It has to do
;with the way the assembler is structured
;internally. Namely, when the core of the
;assembler sees the "jump" instruction, it
;invokes the "getLabelAddress" method of the
;"TreeNode" class. However, when that method
;sees that it's being invoked on an \`?:\`
;operator, it wrongly assumes that all of its
;operands are arithmetic expressions, so
;it invokes the 
;"interpretAsArithmeticExpression" method.
;That method takes as the only argument the
;"constants" argument, and it has no access
;to the labels. There doesn't seem to be
;a simple solution.
    `;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[0].hex).toBe("22004");
  });

  test("Strings containing the colon tokenize correctly", () => { // This was once crashing the assembler: https://github.com/FlatAssembler/PicoBlaze_Simulator_in_JS/issues/39
    const assembly = `
;This is an example program showing how
;":" doesn't tokenize correctly.

address 0
load s9, ":"
    `;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[0].hex).toBe("0193a");
  });

test("The \"print_string\" pseudo-mnemonic works", () => {
const assembly = `
address 0
print_string "Hello world!", s9, UART_TX
load s9, a
call UART_TX
infinite_loop: jump infinite_loop

;Now follows some boilerplate code
;we use in our Computer Architecture
;classes...
CONSTANT LED_PORT,         00
CONSTANT HEX1_PORT,        01
CONSTANT HEX2_PORT,        02
CONSTANT UART_TX_PORT,     03
CONSTANT UART_RESET_PORT,  04
CONSTANT SW_PORT,          00
CONSTANT BTN_PORT,         01
CONSTANT UART_STATUS_PORT, 02
CONSTANT UART_RX_PORT,     03
; Tx data_present
CONSTANT U_TX_D, 00000001'b
; Tx FIFO half_full
CONSTANT U_TX_H, 00000010'b
; TxFIFO full
CONSTANT U_TX_F, 00000100'b
; Rxdata_present
CONSTANT U_RX_D, 00001000'b
; RxFIFO half_full
CONSTANT U_RX_H, 00010000'b
; RxFIFO full
CONSTANT U_RX_F, 00100000'b

UART_RX:
  INPUT sA, UART_STATUS_PORT
  TEST  sA, U_RX_D
  JUMP  NZ, input_not_empty
  LOAD  s0, s0
  JUMP UART_RX
  input_not_empty:
  INPUT s9, UART_RX_PORT
RETURN

UART_TX:
  INPUT  sA, UART_STATUS_PORT
  TEST   sA, U_TX_F
  JUMP   NZ, UART_TX
  OUTPUT s9, UART_TX_PORT
RETURN
`;
    const abstract_syntax_tree = parser.parse(tokenizer.tokenize(assembly));
    const compilation_context =
        preprocessor.makeCompilationContext(abstract_syntax_tree);
    const call_UART_TX="20"+formatAsAddress(compilation_context.labels.get("UART_TX")); 
    assembler.assemble(abstract_syntax_tree, compilation_context);
    expect(machineCode[0].hex).toBe("01948"); // H
    expect(machineCode[1].hex).toBe(call_UART_TX);
    expect(machineCode[2].hex).toBe("01965"); // e
    expect(machineCode[3].hex).toBe(call_UART_TX);
    expect(machineCode[4].hex).toBe("0196c"); // l
    expect(machineCode[5].hex).toBe(call_UART_TX);
    expect(machineCode[6].hex).toBe("0196c"); // l
    expect(machineCode[7].hex).toBe(call_UART_TX);
    expect(machineCode[8].hex).toBe("0196f"); // o
    expect(machineCode[9].hex).toBe(call_UART_TX);
    expect(machineCode[10].hex).toBe("01920"); //  (space)
    expect(machineCode[11].hex).toBe(call_UART_TX);
    expect(machineCode[12].hex).toBe("01977"); // w
    expect(machineCode[13].hex).toBe(call_UART_TX);
    expect(machineCode[14].hex).toBe("0196f"); // o
    expect(machineCode[15].hex).toBe(call_UART_TX);
    expect(machineCode[16].hex).toBe("01972"); // r
    expect(machineCode[17].hex).toBe(call_UART_TX);
    expect(machineCode[18].hex).toBe("0196c"); // l
    expect(machineCode[19].hex).toBe(call_UART_TX);
    expect(machineCode[20].hex).toBe("01964"); // d
    expect(machineCode[21].hex).toBe(call_UART_TX);
    expect(machineCode[22].hex).toBe("01921"); // !
    expect(machineCode[23].hex).toBe(call_UART_TX);
    expect(machineCode[24].hex).toBe("0190a"); // new-line character
    expect(machineCode[25].hex).toBe(call_UART_TX);
  });
});
