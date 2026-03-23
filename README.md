# 韶关公交 PIDS 模拟屏

这是一个参考 [HKTSS/mtr-pids](https://github.com/HKTSS/mtr-pids) 视觉结构改造出来的韶关公交到站屏项目。

页面设计保持港铁的 PIDS 屏幕设计，继续沿用“顶部状态栏 + 提示页 + 四行到站信息 + 配置浮层”这套交互方式，底层数据适配韶关公交 H5 接口，线路和站点选择改成了更适合公交场景的方式：

- 先选公交线路号
- 再选车站名
- 再选单方向、全部方向或双方向分屏
- 注意：起点站或终点站往另一方向的车辆可能一直为 99 分钟，这是正常现象，因为接口中没有发车站的信息。

## 项目结构

- `index.html`
  前端入口，可直接托管到 GitHub Pages。
- `assets/data/shaoguan-routes.json`
  线路静态清单，由脚本生成，负责驱动线路、站点、方向下拉。
- `assets/js/static/data.js`
  公交数据模型、清单读取、方向选项和界面提示配置。
- `assets/js/static/eta_api.js`
  实时数据入口，负责调用代理并转换成屏幕渲染所需的统一结构。
- `proxy/local-proxy.js`
  本地 Node 代理，适合本地开发、测试。
- `proxy/cloudflare-worker.js`
  Cloudflare Worker 版本代理，适合给 GitHub Pages 提供完全线上实时数据。
- `scripts/build-shaoguan-manifest.js`
  从接口拉全量线路和站序，重新生成韶关线路清单。

## 为什么需要代理

很多接口本身没有开放浏览器跨域头，所以：

- GitHub Pages 可以托管前端页面
- 但 GitHub Pages 里的浏览器代码不能直接请求 API

所以这个项目把实时链路拆成了两层：

1. GitHub Pages 托管静态页面和线路清单
2. 使用 Cloudflare Workers 代理，负责转发 `encryptedLineDetail`、补请求头、生成签名、解密返回体

页面配置里的“实时代理地址”填的就是这个代理服务根地址，前端会请求：

```text
<你的代理地址>/api/station-detail
```

## 本地运行示例

### 1. 启动静态页面

```bash
python -m http.server 4173
```

### 2. 启动本地代理

```bash
node proxy/local-proxy.js
```

默认监听：

```text
http://127.0.0.1:8788
```

页面里把“实时代理地址”填成上面这个地址即可。

### 3. 重新生成韶关线路清单

当线路、站点、站序发生变化时，可以重新跑：

```bash
node scripts/build-shaoguan-manifest.js
```

脚本会更新：

```text
assets/data/shaoguan-routes.json
```

设计思路很简单：

- 先爬取全量线路
- 再按线路方向拉完整站序
- 最后将“接口原始线路名”和“界面展示线路号”做好排序，拆开保存

这样像 `101（马坝⇔梅村）` 这类线路，界面还能按 `101` 统一归类，不会把方向说明混进线路下拉里。

## 部署到 GitHub Pages

仓库已经附带 GitHub Pages 工作流(Jekyll)：

- 推送到 main 分支后自动部署静态页面
- 页面内容直接来自仓库根目录

首次启用时只要在 GitHub 仓库设置里打开 Pages，并选择 `GitHub Actions` 作为来源。

## 部署线上代理

### 方案 A：Cloudflare Worker

把 `proxy/cloudflare-worker.js` 部署成 Worker，然后把页面里的“实时代理地址”填成 Worker 域名。

这个 Worker 做的事情只有三件：

- 接收前端传来的线路、方向、站点参数
- 生成 `cryptoSign`
- 请求接口并解密 `encryptResult`

务必开启 Node 兼容模式，即 Cloudflare 中`设置 - 运行时`的兼容性标志需要添加`nodejs_compat`。因为代理里用了 `node:crypto` 来处理 `MD5` 和 `AES-256-ECB`。

### 方案 B：自托管 Node 代理

如果你有自己的服务器，也可以直接跑：

```bash
node proxy/local-proxy.js
```

然后把这个服务挂到公网调用，在`实时代理地址`中输入即可。如需在`数据来源`栏中加入自己的数据源，只需要修改setting.js。

## PIDS 显示所需接口清单

这一节专门写给需要自己适配代理的人看。

仓库里的 `proxy/cloudflare-worker.js` 可能会为了公开发布而暂时移除上游平台、签名算法、加密字段名或请求头细节，所以不要把它当成“开箱即用的完整实现”。真正需要对齐的是前端当前这份接口契约，代码依据在：

- `assets/js/static/eta_api.js`
- `assets/js/static/data.js`
- `assets/data/shaoguan-routes.json`

只要你的代理能稳定返回下面这些字段，PIDS 屏幕就能正常显示；至于你背后接的是哪个公交实时源、如何签名、是否需要解密，都是代理内部实现细节。

### 1. 路线静态清单

前端启动后会先读取：

```text
./assets/data/shaoguan-routes.json
```

最少需要满足这些结构：

```json
{
  "defaultLineNo": "x",
  "lines": [
    {
      "lineNo": "x",
      "displayName": "x路",
      "color": "#0f5c87",
        //color按你喜欢，大部分城市公交都没有标识色吧（？
      "directions": [
        {
          "id": "7-0",
          "lineId": "0751xxxxxxxx",
          "lineName": "x",
          "lineNo": "x",
          "direction": 0,
          "directionLabel": "上行",
          "endStation": "韶关站",
          "badge": "上",
          "stations": [
            {
              "sId": "0xxx-xx",
              "sn": "韶关东站",
              "order": 8
            }
          ]
        }
      ]
    }
  ]
}
```

这里最关键的是：

- `lines[].lineNo` 和 `displayName` 用来做线路下拉
- `directions[]` 用来生成方向下拉和实时查询参数
- `stations[].sId`、`sn`、`order` 分别用于查实时、显示站名、判断站序

### 2. 主实时接口 `GET /api/station-detail`

这是 PIDS 正常显示时优先调用的接口。前端固定会传：

- `stationId`
- `destSId=-1`
- `cityId=241`

前端真正依赖的返回结构最少如下：

```json
{
  "lines": [
    {
      "line": {
        "lineId": ""
      },
      "stnStates": [
        {
          "busId": "bus-001",
          "licence": "粤F12345",
            //接口提供，如果没有也不影响PIDS渲染
          "value": "3",
          "travelTime": "180",
          "arrivalTime": "1760000000000"
        }
      ]
    }
  ]
}
```

前端会这样使用这些字段：

- `lines[].line.lineId`：和静态清单里的 `direction.lineId` 对上，筛出当前方向的数据
- `lines[].stnStates[]`：直接生成到站行
- `stnStates[].value`：预计还有多少分钟到站
- `stnStates[].travelTime`：如果没有绝对时间，就用它推算
- `stnStates[].arrivalTime`：有的话优先显示更准确的绝对到站时间
- `stnStates[].busId`、`licence`：当前主要用于内部元数据和调试，不参与主界面排版，但建议保留

### 3. 回退接口 `GET /api/line-detail`

当前端发现 `/api/station-detail` 里某个方向拿不到 `stnStates` 时，会自动回退请求这个接口。前端会传：

- `lineId`
- `lineName`
- `direction`
- `stationName`
- `nextStationName`
- `lineNo`
- `targetOrder`
- `cityId=241`
- `src=wechat_shaoguan`

前端真正依赖的最小返回结构如下：

```json
{
  "buses": [
    {
      "busId": "bus-001",
      "licence": "粤F12345",
      "order": "6",
      "specialOrder": "6",
      "travelTime": "180"
    }
  ]
}
```

回退逻辑会这样处理：

- 用 `order` 或 `specialOrder` 和 `targetOrder` 比较，找离当前站最近的车
- 用 `travelTime` 换算分钟数并补成 ETA
- 最多取当前画面需要的前几班车，不要求你在代理层二次裁剪

### 4. 前端适配约束

如需适配其他城市，可能需要重写代理，请额外注意这几个约束：

- 前端默认请求相对路径 `/api/station-detail` 和 `/api/line-detail`，所以代理根地址后面要能直接接这两个路由
- 返回体字段名建议保持和上面一致，否则你还要同步改 `assets/js/static/eta_api.js`
- `/api/station-detail` 是主入口，稳定性优先级应该高于 `/api/line-detail`
- `/api/line-detail` 只承担兜底，不建议在代理层做和界面强绑定的二次包装
- 如果你替换了数据源平台，只要能产出同样的字段语义，PIDS 前端不关心底层来自哪个服务

## 致谢与许可

本项目前端壳体、屏幕布局思路和部分静态资源参考了：

- [HKTSS/mtr-pids](https://github.com/HKTSS/mtr-pids)

原参考项目使用 Apache License 2.0，本仓库保留其许可证文件以便继续遵循原始开源许可要求。
