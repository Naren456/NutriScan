document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const uploadBtn = document.querySelector('.upload-btn');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const summaryElement = document.getElementById('summary');
    const benefitsElement = document.getElementById('benefits');
    const harmfulEffectsElement = document.getElementById('harmfulEffects');
    const scanBtn = document.querySelector('.scan-btn');

    // Event Listeners
    uploadBtn.addEventListener('click', () => {
        imageUpload.click();
    });

    // Handle image upload preview
    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        // Display image preview
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.innerHTML = `<img src="${e.target.result}" alt="Food Label Preview">`;
        };
        reader.readAsDataURL(file);
    });

    // Process image when scan button is clicked
    scanBtn.addEventListener('click', processImage);

    // Image processing function
    async function processImage() {
        const file = imageUpload.files[0];
        if (!file) {
            alert('Please upload an image first');
            return;
        }

        // Show processing status
        const processStatus = document.querySelector('.process-status');
        processStatus.style.display = 'block';
        
        try {
            // Create a new worker instance each time
            const worker = await Tesseract.createWorker();
            await worker.loadLanguage('eng');
            await worker.initialize('eng');

            // Perform OCR
            const result = await worker.recognize(file);
            const extractedText = result.data.text;

          
         
            

            await analyzeNutritionLabel(extractedText);
            await worker.terminate();

        } catch (error) {
            console.error('Error:', error);
            summaryElement.textContent = 'Error processing image. Please try again.';
            document.getElementById('resultsSection').style.display = 'none';
        } finally {
            // Hide processing status
            processStatus.style.display = 'none';
        }
    }

    async function analyzeNutritionLabel(text) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDOVN3qEp1wdFlGPKFUwn2B1Dkzu2TbI1E`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Analyze this food label text and provide a detailed response in the following format:
                                
                                Nutrition Facts:
                                - List each nutrient with its value and % Daily Value
                                - Format: [Nutrient]: [Amount] ([%DV])
                                
                                Health Benefits:
                                - List specific health benefits
                                - Focus on positive nutritional aspects
                                
                                Health Concerns:
                                - List potential health risks
                                - Include warnings about excessive values
                                - Note any allergens or sensitive ingredients
                                
                                Overall Assessment:
                                - Provide a brief summary
                                - Include recommendations
                                
                                Here's the label text: ${text}`
                        }]
                    }]
                })
            });

            const data = await response.json();
            const analysis = data.candidates[0].content.parts[0].text;
            updateUIWithAnalysis(analysis);

        } catch (error) {
            console.error('Error analyzing with Gemini:', error);
            summaryElement.innerHTML += '<div class="error">Error analyzing ingredients. Please try again.</div>';
        }
    }

    function updateUIWithAnalysis(analysis) {
        // Extract sections using improved regex patterns
        const nutritionMatch = analysis.match(/Nutrition Facts:(.*?)(?=Health Benefits:|$)/s);
        const concernsMatch = analysis.match(/Health Concerns:(.*?)(?=Overall Assessment:|$)/s);
        const overallMatch = analysis.match(/Overall Assessment:(.*?)$/s);

        // Update Concerns with warning styling first
        if (concernsMatch) {
            harmfulEffectsElement.innerHTML = `
                <div class="concerns-panel">
                    <h3>Health Concerns</h3>
                    <div class="concerns-content">
                        ${formatText(concernsMatch[1],"concern","⚠️")}
                    </div>
                </div>`;
        }

        // Update Nutrition Summary with enhanced styling
        if (nutritionMatch) {
            summaryElement.innerHTML = `
                <div class="nutrition-panel">
                    <h3>Nutrition Facts</h3>
                    <div class="nutrition-content">
                        ${formatNutritionFacts(nutritionMatch[1])}
                    </div>
                </div>`;
        }

        // Add Overall Assessment if present
        if (overallMatch) {
            summaryElement.innerHTML += `
                <div class="overall-panel">
                    <h3>Overall Assessment</h3>
                    <div class="overall-content">
                        ${`<div class="overall-text">${overallMatch[1].trim()}</div>`}
                    </div>
                </div>`;
        }

        document.getElementById('resultsSection').style.display = 'block';
    }

    function formatNutritionFacts(text) {
        // Define harmful substances and their thresholds
        const harmfulThresholds = {
            'Sugars': 15, // grams
            'Added Sugars': 10, // grams
            'Sodium': 500, // mg
            'Cholesterol': 60, // mg
            'Saturated Fat': 4, // grams
            'Trans Fat': 0, // any amount is harmful
            'Total Fat': 20, // grams
        };

        return text
            .trim()
            .split('\n')
            .filter(line => {
                const cleanLine = line.trim();
                return cleanLine && !cleanLine.match(/^\*+$/);
            })
            .map(line => {
                const cleanLine = line.trim()
                    .replace(/\*+/g, '')
                    .replace(/^[-\s]+/, '')
                    .replace(/\s+/g, ' ');

                // Check if the line contains harmful substances or concerning quantities
                let isHarmful = false;
                for (const [substance, threshold] of Object.entries(harmfulThresholds)) {
                    if (cleanLine.toLowerCase().includes(substance.toLowerCase())) {
                        // Extract the numeric value using regex
                        const match = cleanLine.match(/(\d+(?:\.\d+)?)/);
                        if (match) {
                            const value = parseFloat(match[0]);
                            if (value >= threshold) {
                                isHarmful = true;
                                break;
                            }
                        }
                        // For Trans Fat, any presence is harmful
                        if (substance === 'Trans Fat' && cleanLine.includes('g')) {
                            isHarmful = true;
                            break;
                        }
                    }
                }

                return `<div class="nutrition-item ${isHarmful ? 'harmful' : ''}">
                    <span class="nutrient-name">${cleanLine}</span>
                </div>`;
            })
            .join('');
    }

    function formatText(text, benefit,symbol) {
        return text
            .trim()
            .split('\n')
            .filter(line => {
                const cleanLine = line.trim();
                // Filter out empty lines and lines containing only asterisks
                return cleanLine && !cleanLine.match(/^\*+$/);
            })
            .map(line => `<div class="benefit-item">
                <span class="${benefit}-icon">${symbol}</span>
                <span class="${benefit}-text">${line.trim().replace(/[\*\-\s]+/g, ' ').trim()}</span>
            </div>`)
            .join('');
    }
    // Add this function at the end of your DOMContentLoaded event listener
    function toggleResults() {
        const resultsContent = document.querySelector('.results-content');
        const minimizeBtn = document.querySelector('.results-header .minimize-button');
        
        if (resultsContent.classList.contains('minimized')) {
            resultsContent.classList.remove('minimized');
            minimizeBtn.textContent = '≡';
        } else {
            resultsContent.classList.add('minimized');
            minimizeBtn.textContent = '≡';
        }
    }

    // Make the function globally available
    window.toggleResults = toggleResults;
});
