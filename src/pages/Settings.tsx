export default function Settings() {
  return (
    <section aria-label="设置">
      <h2>设置</h2>
      <label>
        ASR 服务商
        <select defaultValue="mock">
          <option value="mock">Mock 本地识别</option>
        </select>
      </label>
      <p>当前 MVP 使用 Mock 本地识别链路验证 UI、预处理、状态和历史存储。</p>
    </section>
  );
}
