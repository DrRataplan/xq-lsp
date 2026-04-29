export interface ParamInfo {
  name: string;
  type?: string;
  description?: string;
}

export interface DocComment {
  description: string;
  params: Record<string, string>; // param name (without $) → description
  returns?: string;
}

export interface FunctionSymbol {
  name: string;         // full qualified name, e.g. "local:add"
  prefix: string;       // namespace prefix, e.g. "local"
  localName: string;    // local part, e.g. "add"
  arity: number;
  params: ParamInfo[];
  returnType?: string;
  doc?: DocComment;
  sourceUri: string;
  sourceOffset?: number; // char offset of the declare keyword
}

export interface VariableSymbol {
  name: string;       // without $, e.g. "sum" or "local:count"
  offset: number;     // char offset in source where it's defined
  isModuleLevel: boolean;
  sourceUri: string;
}

export interface ImportInfo {
  prefix: string;
  namespaceUri: string;
  atPath: string;     // as written in source, e.g. "./other.xq"
}

export interface FileAnalysis {
  functions: FunctionSymbol[];
  moduleVariables: VariableSymbol[];  // declare variable
  localBindings: VariableSymbol[];    // let/for bindings
  imports: ImportInfo[];
}
