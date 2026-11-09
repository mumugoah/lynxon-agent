# Fork 改动登记

本仓库是 `deepseek-ai/lynxon-agent` 的 fork（`mumugoah/lynxon-agent`）。这里登记 fork 上相对上游的每一处改动，合并上游时逐条核对：冲突怎么解、合并后跑什么验证、上游已经有等价能力时就撤掉 fork 改动。

规则：

- 一处改动一节，写清楚为什么要改、改了哪些文件、对外接口、谁在用、合并后怎么验证、上游状态。
- 改动保持最小，只加扩展点，不改上游已有行为；提交标题带 `[fork]`，方便 `git log --grep '\[fork\]'` 找出来。
- 能提给上游的改动在「上游状态」里记 PR 链接；上游合入后删掉这一节。

## 1. 网页端不发启动令牌会话（`--no-browser-session`）

- **原因**：公开部署时由前置网关负责认证，浏览器不需要再走启动令牌 cookie。
- **提交**：`c6bc40ff4e feat(web): serve a trusted browser without the launch-token session`（分支 `web-no-browser-session`）。
- **文件**：`packages/bundle/web-app/src/startup.ts`、`packages/bundle/web-app/cordis.patch.yml`、`packages/client/connection/README*`，以及 CLI 帮助、配置目录、网页服务、公开部署等文档。
- **对外接口**：`dsh web --no-browser-session`；`GET /connect` 仍要求进程令牌。
- **验证**：`packages/bundle/web-app/tests/startup.spec.ts`、`packages/client/connection/tests/node-half.host.spec.ts`。
- **合并注意**：合并上游后 `webserver/index-inject` 多了 `peer` 参数，`node-half.host.spec.ts` 里发这个事件要带上页面 peer（已在 `feat/new-session-preset-provider` 上修好）。
- **上游状态**：未提交。

## 2. 新会话默认 preset 的提供者（`uiWorkspace.provideNewSessionPreset`）

- **原因**：Ontos 的 DeepWorks 插件（`@deepexi/datasense-deepworks-plugin`）按「当前专家」给新会话选 agent preset。DSH 的「新会话」按钮、⌘N 与选择工作区都走 `uiWorkspace.startSession` / `openWorkspace`，不带 preset 时用 Host 默认值；插件没有别的入口让它们跟随当前专家（按钮写死在 `ui-sidebar` 的 `SidebarRoot.tsx`，不是扩展位置）。
- **提交**：分支 `feat/new-session-preset-provider`，标题 `[fork] feat(ui-workspace): let plugins supply the preset of new sessions`。
- **文件**：`packages/client/ui-workspace/src/client/navigation.ts`、`packages/client/ui-workspace/tests/workspaces-service.client.spec.ts`。
- **对外接口**：

  ```ts
  // UiWorkspace
  provideNewSessionPreset(provider: (workspaceId: WorkspaceId) => string | undefined): () => void
  ```

  `openWorkspace` 在调用方没指定 preset 时读最后注册的提供者，并传入目标工作区 id（插件据此按工作区选专家，不跟随当前选中项）；返回 `undefined`、空串或抛错时保持 Host 默认值。显式指定的 preset 优先；启动恢复（`connectWorkspace`）不读提供者。
- **使用方**：Ontos 仓库 `packages/ontos-deepworks-plugin/src/client/index.ts`。插件按可选能力使用：DSH 没有这个方法时，新会话照旧用默认 preset。
- **验证**：`npx vitest run packages/client/ui-workspace/tests/workspaces-service.client.spec.ts`（「asks the latest new-session preset provider…」「keeps the Host default when…」两条）；网页端选一个专家后点「新会话」，新会话页的 preset 选择显示该专家。
- **合并注意**：上游改 `openWorkspace` 签名或把新会话改走别的路径时，把提供者的读取挪到新路径上。
- **上游状态**：未提交。可以作为通用扩展点提给上游（插件按自身状态决定新会话 preset）。
