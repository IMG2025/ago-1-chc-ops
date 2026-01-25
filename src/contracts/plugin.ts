export interface PluginRegistrar<TSpec> {
  registerExecutor(spec: TSpec): void;
}
