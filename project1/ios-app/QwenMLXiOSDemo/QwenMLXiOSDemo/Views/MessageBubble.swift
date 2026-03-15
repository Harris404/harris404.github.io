import SwiftUI

struct MessageBubble: View {
    let message: Message
    
    var body: some View {
        HStack {
            if message.role == .user {
                Spacer()
            }
            
            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                if message.role == .assistant {
                    MarkdownContentView(content: message.content)
                        .padding(12)
                        .background(Color.white)
                        .foregroundColor(.pokeText)
                        .pixelBorder(.pokeBorder)
                        .pixelShadow()
                } else {
                    Text(message.content)
                        .padding(12)
                        .background(Color.pokeRed)
                        .foregroundColor(.white)
                        .pixelBorder(.pokeRedDark)
                        .pixelShadow(Color.pokeRedDark.opacity(0.2))
                }
                
                Text(message.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(.pokeTextLight)
            }
            .frame(maxWidth: 280, alignment: message.role == .user ? .trailing : .leading)
            
            if message.role == .assistant {
                Spacer()
            }
        }
    }
}

// MARK: - Markdown 渲染

struct MarkdownContentView: View {
    let content: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(parseBlocks().enumerated()), id: \.offset) { _, block in
                renderBlock(block)
            }
        }
    }
    
    // MARK: - Block 类型
    
    private enum MarkdownBlock {
        case heading(level: Int, text: String)
        case paragraph(text: String)
        case listItem(ordered: Bool, index: Int, text: String)
        case codeBlock(language: String, code: String)
        case table(headers: [String], rows: [[String]])
        case divider
    }
    
    // MARK: - 解析
    
    private func parseBlocks() -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        let lines = content.components(separatedBy: "\n")
        var i = 0
        var paragraphLines: [String] = []
        var listIndex = 0
        
        func flushParagraph() {
            let text = paragraphLines.joined(separator: "\n").trimmingCharacters(in: .whitespaces)
            if !text.isEmpty {
                blocks.append(.paragraph(text: text))
            }
            paragraphLines.removeAll()
        }
        
        while i < lines.count {
            let line = lines[i]
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            
            // 空行
            if trimmed.isEmpty {
                flushParagraph()
                listIndex = 0
                i += 1
                continue
            }
            
            // 代码块
            if trimmed.hasPrefix("```") {
                flushParagraph()
                let lang = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                var codeLines: [String] = []
                i += 1
                while i < lines.count && !lines[i].trimmingCharacters(in: .whitespaces).hasPrefix("```") {
                    codeLines.append(lines[i])
                    i += 1
                }
                blocks.append(.codeBlock(language: lang, code: codeLines.joined(separator: "\n")))
                i += 1
                continue
            }
            
            // 标题
            if let match = trimmed.range(of: #"^(#{1,3})\s+(.+)$"#, options: .regularExpression) {
                flushParagraph()
                let full = String(trimmed[match])
                let level = full.prefix(while: { $0 == "#" }).count
                let text = String(full.drop(while: { $0 == "#" })).trimmingCharacters(in: .whitespaces)
                blocks.append(.heading(level: level, text: text))
                i += 1
                continue
            }
            
            // 分割线
            if trimmed.range(of: #"^[-*_]{3,}$"#, options: .regularExpression) != nil {
                flushParagraph()
                blocks.append(.divider)
                i += 1
                continue
            }
            
            // 无序列表
            if trimmed.range(of: #"^[-*+]\s+(.+)$"#, options: .regularExpression) != nil {
                flushParagraph()
                let text = String(trimmed.drop(while: { $0 == "-" || $0 == "*" || $0 == "+" || $0 == " " }))
                blocks.append(.listItem(ordered: false, index: 0, text: text))
                i += 1
                continue
            }
            
            // 有序列表
            if trimmed.range(of: #"^\d+[.)]\s+(.+)$"#, options: .regularExpression) != nil {
                flushParagraph()
                listIndex += 1
                let text = String(trimmed.drop(while: { $0.isNumber || $0 == "." || $0 == ")" || $0 == " " }))
                blocks.append(.listItem(ordered: true, index: listIndex, text: text))
                i += 1
                continue
            }
            
            // 表格检测
            if trimmed.contains("|") && i + 1 < lines.count {
                let nextTrimmed = lines[i + 1].trimmingCharacters(in: .whitespaces)
                if nextTrimmed.range(of: #"^\|?[\s-:|]+\|"#, options: .regularExpression) != nil {
                    flushParagraph()
                    let headers = parseCells(trimmed)
                    i += 2 // skip header + separator
                    var rows: [[String]] = []
                    while i < lines.count {
                        let rowLine = lines[i].trimmingCharacters(in: .whitespaces)
                        if rowLine.contains("|") && !rowLine.isEmpty {
                            rows.append(parseCells(rowLine))
                            i += 1
                        } else {
                            break
                        }
                    }
                    blocks.append(.table(headers: headers, rows: rows))
                    continue
                }
            }
            
            // 普通段落
            paragraphLines.append(trimmed)
            i += 1
        }
        
        flushParagraph()
        return blocks
    }
    
    private func parseCells(_ line: String) -> [String] {
        line.split(separator: "|", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }
    
    // MARK: - 渲染
    
    @ViewBuilder
    private func renderBlock(_ block: MarkdownBlock) -> some View {
        switch block {
        case .heading(let level, let text):
            inlineMarkdown(text)
                .font(level == 1 ? .headline : level == 2 ? .subheadline : .subheadline)
                .fontWeight(.bold)
                .foregroundColor(.pokeRed)
                .padding(.top, 2)
            
        case .paragraph(let text):
            inlineMarkdown(text)
                .font(.body)
                .foregroundColor(.pokeText)
            
        case .listItem(let ordered, let index, let text):
            HStack(alignment: .top, spacing: 6) {
                Text(ordered ? "\(index)." : "•")
                    .font(.body)
                    .foregroundColor(.pokeRed)
                    .frame(width: ordered ? 20 : 10, alignment: .leading)
                inlineMarkdown(text)
                    .font(.body)
                    .foregroundColor(.pokeText)
            }
            
        case .codeBlock(_, let code):
            Text(code)
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.pokeGreen)
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.sidebarBg)
                .pixelBorder(.pokeBorderStrong)
            
        case .table(let headers, let rows):
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 0) {
                    ForEach(Array(headers.enumerated()), id: \.offset) { _, header in
                        Text(header)
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.pokeBlueDark)
                            .padding(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .background(Color.pokeBlue.opacity(0.1))
                
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: 0) {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                            Text(cell)
                                .font(.caption)
                                .foregroundColor(.pokeText)
                                .padding(4)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
            .pixelBorder(.pokeBorder)
            
        case .divider:
            Rectangle()
                .fill(Color.pokeBorder)
                .frame(height: 2)
                .padding(.vertical, 4)
        }
    }
    
    // MARK: - 内联 Markdown
    
    private func inlineMarkdown(_ text: String) -> Text {
        if let attributed = try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
            return Text(attributed)
        }
        return Text(text)
    }
}
