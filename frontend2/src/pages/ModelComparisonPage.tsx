import { useState } from 'react';
import { Sparkles, Zap, DollarSign, Clock, AlertCircle } from 'lucide-react';

interface ComparisonResult {
  model: string;
  provider: string;
  answer: string;
  cost: number;
  responseTime: number;
  status: 'loading' | 'success' | 'error';
  error?: string;
}

const MODEL_OPTIONS = [
  { id: 'gpt-5.2',            name: 'GPT-5.2',             provider: 'OpenAI',    color: 'bg-green-500' },
  { id: 'gpt-4.1',            name: 'GPT-4.1',             provider: 'OpenAI',    color: 'bg-green-400' },
  { id: 'claude-sonnet-4-6',  name: 'Claude Sonnet 4.6',   provider: 'Anthropic', color: 'bg-orange-500' },
  { id: 'claude-haiku-4-5',   name: 'Claude Haiku 4.5',    provider: 'Anthropic', color: 'bg-orange-400' },
  { id: 'gemini-2.5-pro',     name: 'Gemini 2.5 Pro',      provider: 'Google',    color: 'bg-blue-500' },
  { id: 'gemini-2.5-flash',   name: 'Gemini 2.5 Flash',    provider: 'Google',    color: 'bg-blue-400' },
];

export function ModelComparisonPage() {
  const [query, setQuery] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['gpt-5.2', 'claude-sonnet-4-6', 'gemini-2.5-pro']);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      if (selectedModels.length > 1) {
        setSelectedModels(selectedModels.filter(id => id !== modelId));
      }
    } else {
      if (selectedModels.length < 3) {
        setSelectedModels([...selectedModels, modelId]);
      }
    }
  };

  const handleCompare = async () => {
    if (!query.trim()) {
      alert('질문을 입력해주세요.');
      return;
    }

    setIsComparing(true);
    setResults([]);

    // 선택된 모델 초기화
    const initialResults: ComparisonResult[] = selectedModels.map(modelId => {
      const model = MODEL_OPTIONS.find(m => m.id === modelId)!;
      return {
        model: model.name,
        provider: model.provider,
        answer: '',
        cost: 0,
        responseTime: 0,
        status: 'loading' as const,
      };
    });
    setResults(initialResults);

    // Mock API 호출 (실제로는 Gateway API 호출)
    // TODO: 실제 API 연동 필요
    // POST /v1/chat/completions with X-API-Key header
    await Promise.all(
      selectedModels.map(async (modelId, index) => {
        const model = MODEL_OPTIONS.find(m => m.id === modelId)!;

        // 랜덤 응답 시간 시뮬레이션
        const responseTime = 1000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, responseTime));

        // Mock 응답 데이터
        const mockAnswer = generateMockAnswer(model.name, query);
        const mockCost = getMockCost(modelId);

        setResults(prev => {
          const newResults = [...prev];
          newResults[index] = {
            model: model.name,
            provider: model.provider,
            answer: mockAnswer,
            cost: mockCost,
            responseTime: responseTime / 1000,
            status: 'success',
          };
          return newResults;
        });
      })
    );

    setIsComparing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="text-indigo-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">AI 모델 비교</h1>
          </div>
          <p className="text-gray-600">
            같은 질문을 여러 AI 모델에 보내고 답변, 비용, 속도를 비교해보세요
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              질문 입력
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: 프랑스 혁명의 원인을 3가지로 요약해줘"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비교할 모델 선택 (최대 3개)
            </label>
            <div className="flex flex-wrap gap-2">
              {MODEL_OPTIONS.map((model) => {
                const isSelected = selectedModels.includes(model.id);
                const isDisabled = !isSelected && selectedModels.length >= 3;

                return (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    disabled={isDisabled}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${isSelected
                        ? `${model.color} text-white shadow-md`
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {model.name}
                    {isSelected && ' ✓'}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleCompare}
            disabled={isComparing || !query.trim()}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isComparing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                비교 중...
              </>
            ) : (
              <>
                <Zap size={20} />
                모델 비교하기
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {results.map((result, index) => (
              <ResultCard key={index} result={result} />
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">데모 모드</p>
            <p className="text-blue-700">
              현재는 Mock 데이터로 동작합니다. 실제 API 연동을 위해서는 워크스페이스에 각 모델별 Prompt를 생성하고 API 키를 설정해야 합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: ComparisonResult }) {
  const modelColor = MODEL_OPTIONS.find(m => m.name === result.model)?.color || 'bg-gray-500';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className={`${modelColor} p-4 text-white`}>
        <h3 className="font-semibold text-lg">{result.model}</h3>
        <p className="text-sm opacity-90">{result.provider}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-green-600" />
          <div>
            <p className="text-xs text-gray-500">비용</p>
            <p className="font-semibold text-gray-900">
              {result.status === 'loading' ? '...' : `$${result.cost.toFixed(4)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-600" />
          <div>
            <p className="text-xs text-gray-500">응답 시간</p>
            <p className="font-semibold text-gray-900">
              {result.status === 'loading' ? '...' : `${result.responseTime.toFixed(1)}초`}
            </p>
          </div>
        </div>
      </div>

      {/* Answer */}
      <div className="p-4">
        {result.status === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          </div>
        )}

        {result.status === 'success' && (
          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {result.answer}
            </p>
          </div>
        )}

        {result.status === 'error' && (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
            <p className="text-sm text-red-600">{result.error || '오류가 발생했습니다'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Mock 데이터 생성 함수들
function generateMockAnswer(modelName: string, query: string): string {
  const answers: Record<string, string> = {
    'GPT-5.2': `[GPT-5.2 답변]

질문에 대한 상세한 답변을 제공합니다. GPT-5.2는 최신 정보를 바탕으로 정확하고 포괄적인 답변을 생성합니다.

주요 포인트:
1. 첫 번째 핵심 내용
2. 두 번째 중요한 사항
3. 세 번째 보충 설명

이러한 관점에서 볼 때, ${query}에 대한 종합적인 이해가 필요합니다.`,

    'GPT-4.1': `[GPT-4.1 답변]

안정적이고 균형 잡힌 답변을 제공합니다.

주요 포인트:
1. 첫 번째 핵심 내용
2. 두 번째 중요한 사항
3. 세 번째 보충 설명

${query}에 대한 포괄적인 분석을 바탕으로 답변드립니다.`,

    'Claude Sonnet 4.6': `[Claude Sonnet 4.6 답변]

질문을 분석한 결과, 다음과 같이 답변드립니다.

Claude는 논리적 추론과 분석에 강점이 있어, 복잡한 주제를 체계적으로 설명합니다:

• 핵심 개념 설명
• 배경과 맥락 분석
• 실용적인 시사점

따라서 ${query}는 이러한 관점에서 이해할 수 있습니다.`,

    'Claude Haiku 4.5': `[Claude Haiku 4.5 답변]

간결하고 빠른 답변을 제공합니다.

• 핵심 포인트 1
• 핵심 포인트 2
• 핵심 포인트 3

${query}에 대한 핵심만 짚어 드렸습니다.`,

    'Gemini 2.5 Pro': `[Gemini 2.5 Pro 답변]

고성능 추론으로 답변을 제공합니다!

✨ 주요 내용:
- 첫 번째 포인트: 핵심 내용
- 두 번째 포인트: 심층 분석
- 세 번째 포인트: 결론

Gemini 2.5 Pro는 복잡한 추론과 코딩에 최적화되어 있습니다. ${query}에 대한 답변이 도움이 되셨기를 바랍니다!`,

    'Gemini 2.5 Flash': `[Gemini 2.5 Flash 답변]

빠르고 효율적인 답변을 제공합니다!

✨ 주요 내용:
- 첫 번째 포인트: 핵심 내용
- 두 번째 포인트: 보충 설명
- 세 번째 포인트: 결론

Gemini 2.5 Flash는 속도와 비용 효율성이 뛰어납니다. ${query}에 대한 답변이 도움이 되셨기를 바랍니다!`,
  };

  return answers[modelName] || `[${modelName}의 답변]\n\n${query}에 대한 답변입니다.`;
}

function getMockCost(modelId: string): number {
  const costs: Record<string, number> = {
    'gpt-5.2': 0.032,
    'gpt-4.1': 0.018,
    'claude-sonnet-4-6': 0.024,
    'claude-haiku-4-5': 0.008,
    'gemini-2.5-pro': 0.016,
    'gemini-2.5-flash': 0.004,
  };
  return costs[modelId] || 0.01;
}
