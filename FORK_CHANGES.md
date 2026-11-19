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
- **合并注意**：合并上游后 `webserver/index-inject` 多了 `peer` 参数，`node-half.host.spec.ts` 里发这个事件要带上页面 peer（已修好，提交 `ad4835c057`）。
- **上游状态**：未提交。
