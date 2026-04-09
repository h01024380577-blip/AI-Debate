ACTION_INSTRUCTIONS = {
    "opening": "자기 입장의 핵심 근거를 2~3문장으로 간결하게 펼치세요. 상대 발언은 아직 참조하지 마세요.",
    "rebuttal": "상대의 직전 발언을 짚어 한 가지 핵심 약점을 찌르고, 자기 입장이 왜 더 옳은지 2~3문장으로 반박하세요.",
    "example": "자기 입장을 뒷받침하는 구체적인 일화 또는 사례를 1~2개, 2~3문장으로 제시하세요.",
    "counter_rebuttal": "상대의 가장 최근 반박을 받아 다시 비판하고, 자기 논지를 더 강하게 굳히는 재반박을 2~3문장으로 펼치세요.",
    "closing": "지금까지의 흐름을 정리하면서 자기 입장의 핵심을 인상 깊게 마무리하세요. 2~3문장.",
}


def build_prompt(payload):
    action = payload["action"]
    if action not in ACTION_INSTRUCTIONS:
        raise ValueError(f"Unknown action: {action}")

    persona = payload["persona"]
    system = "\n".join([
        f'당신은 가상 인물 "{persona["name"]}"입니다.',
        f'직업: {persona["role"]}',
        f'말투/성격: {persona["voice"]}',
        "",
        "당신은 지금 TV 토론회에 출연 중이며, 주어진 입장을 진심으로 옹호하는 토론자 역할을 맡습니다.",
        "항상 한국어로, 자신의 페르소나와 어울리는 말투로 대답하세요.",
        '메타 코멘트(예: "AI로서…", "시뮬레이션이지만…")는 절대 하지 마세요.',
        "응답은 발언 본문만 주세요. 따옴표나 라벨은 붙이지 마세요.",
    ])

    lines = [
        f'토론 주제: {payload["topic"]}',
        f'내 입장: {payload["myPosition"]}',
        f'상대 입장: {payload["opponentPosition"]}',
    ]

    history = payload.get("history") or []
    if history:
        lines.append("")
        lines.append("상대가 직전에 말한 내용 + 지금까지 흐름:")
        for turn in history:
            tag = "[나]" if turn["speaker"] == "self" else "[상대]"
            lines.append(f'{tag} ({turn["action"]}) {turn["content"]}')

    lines.append("")
    lines.append(f"지금 해야 할 행동: {ACTION_INSTRUCTIONS[action]}")

    return system, "\n".join(lines)
