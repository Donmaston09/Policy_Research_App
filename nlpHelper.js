// A simple procedural NLP engine fallback for generation without an LLM
class NLPGenerator {
    constructor() {
        this.actionVerbs = ["constitute", "review", "enact", "establish", "develop", "implement", "assess"];
        this.actors = ["The Minister of Industry, Trade and Investment", "The National Assembly", "Relevant Stakeholders", "A National Technical Working Committee"];
    }

    extractKeywords(text) {
        // Very basic NLP extraction: find common longer words, ignoring basic stop words.
        const stopWords = new Set(["the", "and", "a", "to", "of", "in", "i", "is", "that", "it", "on", "you", "this", "for", "but", "with", "are", "have", "be", "at", "or", "as", "was", "so", "if", "out", "not", "should", "could", "would", "from", "their", "they", "we", "by", "an", "such"]);
        
        const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        const frequencies = {};
        
        for (const word of words) {
            if (word.length > 4 && !stopWords.has(word)) {
                frequencies[word] = (frequencies[word] || 0) + 1;
            }
        }
        
        // Sort by frequency
        return Object.keys(frequencies).sort((a, b) => frequencies[b] - frequencies[a]).slice(0, 5);
    }

    generateDateOffset(months) {
        const date = new Date();
        date.setMonth(date.getMonth() + months);
        const quarter = Math.floor((date.getMonth() + 3) / 3);
        const quarters = ["First", "Second", "Third", "Fourth"];
        return `${quarters[quarter-1]} Quarter, ${date.getFullYear()}`;
    }

    generate(findings) {
        const keywords = this.extractKeywords(findings);
        if (keywords.length < 2) {
            keywords.push("industrial policies", "technology development", "economic resilience");
        }
        
        let output = `**Recommendation One**\n`;
        output += `The Federal Government should carry out a comprehensive review of existing policies focusing on ${keywords[0]} and ${keywords[1]} to incorporate local production capabilities.\n\n`;
        
        output += `**Implementation Strategies;**\n`;
        
        // Strategy 1
        output += `i. ${this.actors[0]} to ${this.actionVerbs[0]} a committee to review and integrate ${keywords[0]} into the draft policy by ${this.generateDateOffset(3)}.\n`;
        
        // Strategy 2
        output += `ii. ${this.actors[2]} to study, amend and approve the framework surrounding ${keywords[1] || 'general operations'} by ${this.generateDateOffset(9)}.\n`;
        
        // Strategy 3
        output += `iii. ${this.actors[1]} to ${this.actionVerbs[2]} relevant laws to back the new initiative by ${this.generateDateOffset(12)}.\n`;

        if (keywords.length > 2) {
            output += `\n**Recommendation Two**\n`;
            output += `Establish an integrated framework targeting ${keywords[2]} for long term sustainability.\n\n`;
            output += `**Implementation Strategies;**\n`;
            output += `i. ${this.actors[0]} to ${this.actionVerbs[6]} the impact of ${keywords[2]} by ${this.generateDateOffset(6)}.\n`;
            output += `ii. Introduce robust capacity building around ${keywords[3] || 'advanced metrics'} by ${this.generateDateOffset(12)}.\n`;
        }

        return output;
    }
}

const nlpGenerator = new NLPGenerator();
