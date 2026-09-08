export default function WorkflowResultSummary({ steps, summary, apis, onConfirm, onRetry }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200">
        {/* 标题 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">AI 工作流执行完成</h2>
          <p className="text-sm text-blue-100 mt-1">请确认解析结果后继续</p>
        </div>

        {/* 整体质量评估 */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{summary.totalApis}</div>
              <div className="text-xs text-gray-600 mt-1">识别接口数</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {summary.confidence === 'high' && '高'}
                {summary.confidence === 'medium' && '中'}
                {summary.confidence === 'low' && '低'}
              </div>
              <div className="text-xs text-gray-600 mt-1">识别置信度</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{summary.qualityScore}</div>
              <div className="text-xs text-gray-600 mt-1">质量评分</div>
            </div>
          </div>
        </div>

        {/* 步骤详情 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">执行步骤详情</h3>
          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.step} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  {/* 状态图标 */}
                  <span className="flex-shrink-0 mt-1">
                    {step.status === 'success' && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
                        ✓
                      </span>
                    )}
                    {step.status === 'error' && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600">
                        ✗
                      </span>
                    )}
                  </span>

                  {/* 步骤信息 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500">Step {step.step}</span>
                      <span className="text-sm font-medium text-gray-800">{step.name}</span>
                    </div>

                    {/* 结果详情 */}
                    {step.result && (
                      <div className="text-xs text-gray-600 space-y-1">
                        {step.result.apiCount !== undefined && (
                          <div>• 识别到 <span className="font-medium">{step.result.apiCount}</span> 个接口</div>
                        )}
                        {step.result.confidence && (
                          <div>• 置信度: <span className="font-medium">{step.result.confidence}</span></div>
                        )}
                        {step.result.validated !== undefined && (
                          <div>• 验证通过 <span className="font-medium">{step.result.validated}</span> 个接口</div>
                        )}
                        {step.result.enhanced !== undefined && step.result.enhanced > 0 && (
                          <div>• 自动增强 <span className="font-medium">{step.result.enhanced}</span> 处数据</div>
                        )}
                        {step.result.qualityScore !== undefined && (
                          <div>• 质量评分: <span className="font-medium">{step.result.qualityScore}/100</span></div>
                        )}

                        {/* 问题列表 */}
                        {step.result.issues && step.result.issues.length > 0 && (
                          <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                            <div className="font-medium text-amber-800 mb-1">发现的问题：</div>
                            <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                              {step.result.issues.map((issue, i) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* 警告信息 */}
                        {step.result.warnings && step.result.warnings.length > 0 && (
                          <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                            <div className="font-medium text-yellow-800 mb-1">警告信息：</div>
                            <ul className="list-disc list-inside text-yellow-700 space-y-0.5">
                              {step.result.warnings.slice(0, 5).map((warning, i) => (
                                <li key={i}>{warning}</li>
                              ))}
                              {step.result.warnings.length > 5 && (
                                <li className="text-xs">...还有 {step.result.warnings.length - 5} 条警告</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 错误信息 */}
                    {step.status === 'error' && (
                      <div className="mt-2 p-2 bg-red-50 rounded border border-red-200 text-xs text-red-700">
                        {step.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API 列表预览 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">识别到的接口（前 5 个）</h3>
          <div className="space-y-2">
            {apis.slice(0, 5).map((api, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-xs">
                <span className="font-mono font-medium text-blue-600 w-16">{api.method}</span>
                <span className="flex-1 text-gray-800">{api.name}</span>
                <span className="text-gray-500 font-mono">{api.url}</span>
              </div>
            ))}
            {apis.length > 5 && (
              <div className="text-xs text-gray-500 text-center py-1">
                ...还有 {apis.length - 5} 个接口
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex items-center justify-between">
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
          >
            重新解析
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            确认结果，继续下一步 →
          </button>
        </div>
      </div>
    </div>
  )
}
