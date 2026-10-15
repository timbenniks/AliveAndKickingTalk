// Local, read-only evidence export for the MG3 study. No application patching.
// @category Analysis.MG3
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.app.cmd.function.ApplyFunctionSignatureCmd;
import ghidra.program.model.data.*;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;

public class DeepMG3 extends GhidraScript {
  public void run() throws Exception {
    String[] args = getScriptArgs();
    if (!"0d2362d7760523f4169d9bbf6cb4ca03b675fda0a36a64b558bbae53129d672d".equals(currentProgram.getExecutableSHA256()) ||
        !"AARCH64:LE:64:AppleSilicon".equals(currentProgram.getLanguageID().toString())) {
      throw new IllegalArgumentException("This address set requires the pinned MG3 ARM64 study.");
    }
    File out = new File(args[1]); out.mkdirs();
    // Correct import ABI signatures only; leave instruction bytes untouched.
    FunctionIterator all = currentProgram.getFunctionManager().getFunctions(true);
    while (all.hasNext()) {
      Function f = all.next();
      String n = f.getName();
      int count = n.matches("_(pow|powf|atan2|atan2f)") ? 2 :
        n.matches("_(log|logf|log10|log10f|exp|expf|sqrt|sqrtf|sin|sinf|cos|cosf)") ? 1 : 0;
      if (count == 0) continue;
      DataType t = n.endsWith("f") ? FloatDataType.dataType : DoubleDataType.dataType;
      FunctionDefinitionDataType sig = new FunctionDefinitionDataType(n);
      sig.setReturnType(t);
      ParameterDefinition[] p = new ParameterDefinition[count];
      for (int i = 0; i < count; i++) p[i] = new ParameterDefinitionImpl("arg" + i, t, null);
      sig.setArguments(p);
      new ApplyFunctionSignatureCmd(f.getEntryPoint(), sig, SourceType.USER_DEFINED).applyTo(currentProgram);
    }
    LinkedHashSet<Function> selected = new LinkedHashSet<>();
    List<String> targets = Files.readAllLines(Path.of(args[0]));
    try (PrintWriter w = new PrintWriter(new File(out, "index.txt"))) {
      w.println("Program: " + currentProgram.getName() + " language=" + currentProgram.getLanguageID());
      for (String line : targets) {
        if (line.isBlank() || line.startsWith("#")) continue;
        String[] parts = line.split(" ");
        Address a = toAddr(parts[0]);
        if (parts.length > 1 && parts[1].equals("vtable")) {
          w.println("VTABLE " + a);
          for (int j = 0; j < 40; j++) {
            Address slot = a.add(j * 8);
            Address value = toAddr(getLong(slot));
            Function f = getFunctionAt(value);
            w.println("SLOT +" + Integer.toHexString(j * 8) + " " + value + " " + f);
            if (f != null && f.getBody().getNumAddresses() >= 64) selected.add(f);
          }
        } else {
          Function f = getFunctionAt(a);
          if (f != null) selected.add(f);
          for (Reference ref : getReferencesTo(a)) {
            Function caller = getFunctionContaining(ref.getFromAddress());
            w.println("REF " + a + " <- " + ref.getFromAddress() + " " + caller);
          }
        }
      }
      for (Function f : new ArrayList<>(selected)) {
        w.println("FUNCTION " + f.getEntryPoint() + " bytes=" + f.getBody().getNumAddresses());
        for (Function c : f.getCalledFunctions(monitor)) {
          w.println("CALL " + c.getEntryPoint() + " " + c.getName());
          // Keep graph bounded; libc and generic C++ sorting are not detector evidence.
          if (!c.isThunk() && !c.isExternal() && c.getBody().getNumAddresses() >= 64 &&
              c.getBody().getNumAddresses() < 15000 && selected.size() < 100) selected.add(c);
        }
      }
    }
    DecompInterface decomp = new DecompInterface(); decomp.openProgram(currentProgram);
    try {
      for (Function f : selected) {
        if (monitor.isCancelled()) break;
        String id = f.getEntryPoint().toString();
        DecompileResults r = decomp.decompileFunction(f, 45, monitor);
        try (PrintWriter w = new PrintWriter(new File(out, id + ".c"))) {
          w.println("/* " + f.getName() + " " + id + " */");
          w.println(r.decompileCompleted() ? r.getDecompiledFunction().getC() : r.getErrorMessage());
        }
        try (PrintWriter w = new PrintWriter(new File(out, id + ".asm"))) {
          // Switch destinations may be absent from Ghidra's initial function body.
          // Include every instruction address represented in decompiler p-code.
          TreeSet<Address> addresses = new TreeSet<>();
          InstructionIterator body = currentProgram.getListing().getInstructions(f.getBody(), true);
          while (body.hasNext()) addresses.add(body.next().getAddress());
          if (r.decompileCompleted() && r.getHighFunction() != null) {
            var ops = r.getHighFunction().getPcodeOps();
            while (ops.hasNext()) addresses.add(ops.next().getSeqnum().getTarget());
          }
          w.println("Declared body bytes=" + f.getBody().getNumAddresses() + "; exported instruction addresses=" + addresses.size());
          Iterator<Address> instructions = addresses.iterator();
          while (instructions.hasNext()) {
            Address instructionAddress = instructions.next();
            Instruction i = getInstructionAt(instructionAddress);
            if (i == null && currentProgram.getMemory().contains(instructionAddress)) {
              disassemble(instructionAddress);
              i = getInstructionAt(instructionAddress);
            }
            if (i == null) { w.println("UNDECODED " + instructionAddress); continue; }
            w.println(i.getAddress() + " " + i);
            for (Reference ref : i.getReferencesFrom()) {
              Address a = ref.getToAddress();
              if (!ref.getReferenceType().isData() || !currentProgram.getMemory().contains(a)) continue;
              w.print("  DATA " + a);
              // Hex bytes plus scalar views: SIMD vectors are not necessarily doubles.
              try {
                for (int j = 0; j < 4; j++) w.print(String.format(" %08x", getInt(a.add(j * 4))));
                w.println(" f32=" + Float.intBitsToFloat(getInt(a)) + " f64=" + Double.longBitsToDouble(getLong(a)));
              } catch (Exception e) { w.println(" [end of mapped memory]"); }
            }
          }
        }
      }
    } finally { decomp.dispose(); }
    println("Exported " + selected.size() + " functions; instruction bytes unchanged.");
  }
}
