import { useState } from 'react'

export default function SimpleWorkflowProgress({ steps }) {
  const [expandedSteps, setExpandedSteps] = useState(new Set())

  const toggleStep = (stepNumber) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepNumber)) {
      newExpanded.delete(stepNumber)
    } else {
      newExpanded.add(stepNumber)
    }
    setExpandedSteps(newExpanded)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3 text-gray-700">AI 工作流执行进度</h3>

      <div className="space-y-2">
        {steps.map((step) => {
          const isExpanded = expandedSteps.has(step.step)

          return (
            <div key={step.step} className={`border border-gray-200 rounded transition-all ${step.status === 'running' ? 'bg-blue-50/30 animate-pulse' : ''}`}>
              <button
                onClick={() => toggleStep(step.step)}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 text-left"
              >
                {/* 状态图标 */}
                <span className="flex-shrink-0">
                  {step.status === 'success' && <span className="text-green-600 text-lg">✓</span>}
                  {step.status === 'error' && <span className="text-red-600 text-lg">✗</span>}
                  {step.status === 'running' && (
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  )}
                </span>

                {/* 步骤信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Step {step.step}</span>
                    <span className="text-sm font-medium text-gray-700">{step.name}</span>
                  </div>

                  {/* 简要结果 */}
                  {step.status === 'success' && step.result && (
                    <div className="text-xs text-gray-500 mt-1">
                      {step.result.apiCount !== undefined && `识别 ${step.result.apiCount} 个接口`}
                      {step.result.confidence && ` · 置信度: ${step.result.confidence}`}
                      {step.result.validated !== undefined && `验证 ${step.result.validated} 个`}
                      {step.result.enhanced !== undefined && ` · 增强 ${step.result.enhanced} 处`}
                    </div>
                  )}

                  {/* 运行中的实时详情 */}
                  {step.status === 'running' && step.detail && (
                    <div className="text-xs text-blue-600 mt-1">{step.detail}</div>
                  )}

                  {step.status === 'error' && (
                    <div className="text-xs text-red-600 mt-1">{step.error}</div>
                  )}
                </div>

                {/* 展开图标 */}
                <span className="text-gray-400 text-xs">
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>

              {/* 展开详情 */}
              {isExpanded && step.result && (
                <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-xs">
                  {step.result.issues && step.result.issues.length > 0 && (
                    <div className="mb-2">
                      <div className="font-medium text-gray-700 mb-1">发现的问题：</div>
                      <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {step.result.issues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {step.result.warnings && step.result.warnings.length > 0 && (
                    <div className="mb-2">
                      <div className="font-medium text-gray-700 mb-1">警告信息：</div>
                      <ul className="list-disc list-inside text-amber-600 space-y-1">
                        {step.result.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {step.result.qualityScore !== undefined && (
                    <div className="text-gray-600">
                      质量评分: <span className="font-medium">{step.result.qualityScore}/100</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
