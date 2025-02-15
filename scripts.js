// Инициализация карты
const map = L.map('map').setView([48.0196, 66.9237], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Добавление маркеров на карту с эмоджи
const locations = [
    { lat: 43.2220, lng: 76.8512, type: 'solar', name: 'Солнечная электростанция Алматы', emoji: '☀️' },
    { lat: 51.1605, lng: 71.4704, type: 'wind', name: 'Ветропарк Астана', emoji: '🌬️' },
    { lat: 49.9508, lng: 82.6015, type: 'hydro', name: 'ГЭС Усть-Каменогорск', emoji: '💧' }
];

locations.forEach(loc => {
    L.marker([loc.lat, loc.lng])
        .bindPopup(`${loc.emoji} ${loc.name}`)
        .addTo(map);
});

// Калькуляторы
document.getElementById('solar-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const area = parseFloat(document.getElementById('solar-area').value);
    const efficiency = parseFloat(document.getElementById('solar-efficiency').value) / 100;

    if (isNaN(area) || isNaN(efficiency)) {
        displayResult('solar-result', "Введите корректные данные.");
        return;
    }

    // Среднегодовая солнечная радиация для Казахстана (кВт⋅ч/м²/год)
    const averageRadiation = 1200;
    const annualEnergy = area * averageRadiation * efficiency;
    displayResult('solar-result', `Ожидаемая годовая выработка: ${annualEnergy.toFixed(2)} кВт⋅ч`);
});

document.getElementById('wind-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const diameter = parseFloat(document.getElementById('wind-diameter').value);
    const speed = parseFloat(document.getElementById('wind-speed').value);
    const efficiency = parseFloat(document.getElementById('wind-efficiency').value) / 100;

    if (isNaN(diameter) || isNaN(speed) || isNaN(efficiency)) {
        displayResult('wind-result', "Введите корректные данные.");
        return;
    }

    const area = Math.PI * Math.pow(diameter / 2, 2);
    const power = 0.5 * 1.225 * area * Math.pow(speed, 3) * efficiency;
    displayResult('wind-result', `Ожидаемая мощность: ${power.toFixed(2)} Вт`);
});

document.getElementById('hydro-form').addEventListener('submit', function (e) {
    e.preventDefault();

    // Проверяем выбран ли регион
    const activeRegion = document.querySelector('.region-btn.active');
    if (!activeRegion) {
        displayResult('hydro-result', "Пожалуйста, сначала выберите регион");
        return;
    }

    // Получаем данные из формы и региона
    const regionData = REGIONAL_DATA[activeRegion.dataset.region];
    const height = parseFloat(document.getElementById('hydro-height').value);
    const efficiency = parseFloat(document.getElementById('hydro-efficiency').value) / 100;
    const waterFlow = regionData.waterFlow; // Берем расход воды из данных региона

    // Проверяем введенные данные
    if (isNaN(height) || isNaN(efficiency)) {
        displayResult('hydro-result', "Пожалуйста, введите все данные");
        return;
    }

    // Константы для расчета
    const waterDensity = 1000; // плотность воды (кг/м³)
    const gravity = 9.81;      // ускорение свободного падения (м/с²)

    // Расчет мощности и энергии
    const power = (waterDensity * gravity * waterFlow * height * efficiency) / 1000; // кВт
    const annualEnergy = calculateAnnualEnergy(power);
    const totalCost = power * ENERGY_COSTS.hydro.installationCost;
    const annualOperationalCost = power * ENERGY_COSTS.hydro.operationalCost;
    const paybackPeriod = calculatePayback(totalCost, annualEnergy);

    // Отображаем результаты
    displayResult('hydro-result',
        `Установленная мощность: ${power.toFixed(2)} кВт\n` +
        `Годовая выработка: ${annualEnergy.toFixed(2)} кВт⋅ч\n` +
        `Расход воды в регионе: ${waterFlow} м³/с\n` +
        `Стоимость установки: ${totalCost.toFixed(0)} тенге\n` +
        `Годовая экономия: ${(annualEnergy * ELECTRICITY_PRICE).toFixed(0)} тенге\n` +
        `Срок окупаемости: ${paybackPeriod.toFixed(1)} лет`,
        power,
        annualEnergy
    );
});

// Константы для расчета LCOE и экономических показателей (для малых частных установок)
const ENERGY_COSTS = {
    solar: {
        installationCost: 250000, // тенге за кВт (малые солнечные панели)
        operationalCost: 5000,    // тенге/год за кВт
        lifetime: 25,             // лет
        efficiency: 0.15,         // 15%
        minPower: 1,             // минимальная мощность в кВт
        maxPower: 10             // максимальная мощность в кВт для частного дома
    },
    wind: {
        installationCost: 300000, // тенге за кВт (малые ветрогенераторы)
        operationalCost: 7000,    // тенге/год за кВт
        lifetime: 20,             // лет
        efficiency: 0.35,         // 35%
        minPower: 0.5,           // минимальная мощность в кВт
        maxPower: 5              // максимальная мощность в кВт для частного дома
    },
    hydro: {
        installationCost: 400000, // тенге за кВт (микро-ГЭС)
        operationalCost: 8000,    // тенге/год за кВт
        lifetime: 30,             // лет уменьшен для малых установок
        efficiency: 0.75,         // 75% для малых установок
        minPower: 0.3,           // минимальная мощность в кВт
        maxPower: 3              // максимальная мощность в кВт для частного дома
    }
};

function calculateLCOE(totalCost, annualGeneration, lifetime, operationalCost) {
    const discountRate = 0.05; // 5% ставка дисконтирования
    let presentValueCosts = totalCost;
    let presentValueEnergy = 0;

    for (let year = 1; year <= lifetime; year++) {
        presentValueCosts += operationalCost / Math.pow(1 + discountRate, year);
        presentValueEnergy += annualGeneration / Math.pow(1 + discountRate, year);
    }

    return presentValueCosts / presentValueEnergy;
}

// Константа для расчета тарифа
const ELECTRICITY_PRICE = 20; // тенге за кВт⋅ч

// Функция для расчета годовой выработки в кВт⋅ч
function calculateAnnualEnergy(power) {
    return power * 24 * 365; // мощность * часов в день * дней в году
}

// Функция для расчета окупаемости
function calculatePayback(totalCost, annualEnergy) {
    const annualSavings = annualEnergy * ELECTRICITY_PRICE;
    return totalCost / annualSavings;
}

document.getElementById('solar-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const area = parseFloat(document.getElementById('solar-area').value);
    const efficiency = parseFloat(document.getElementById('solar-efficiency').value) / 100;

    if (isNaN(area) || isNaN(efficiency)) {
        displayResult('solar-result', "Введите корректные данные.");
        return;
    }

    const averageRadiation = 1200; // кВт⋅ч/м²/год
    const power = area * efficiency; // кВт
    const annualEnergy = calculateAnnualEnergy(power);
    const totalCost = power * ENERGY_COSTS.solar.installationCost;
    const annualOperationalCost = power * ENERGY_COSTS.solar.operationalCost;

    const lcoe = calculateLCOE(totalCost, annualEnergy, ENERGY_COSTS.solar.lifetime, annualOperationalCost);
    const paybackPeriod = calculatePayback(totalCost, annualEnergy);

    displayResult('solar-result',
        `Установленная мощность: ${power.toFixed(2)} кВт\n` +
        `Годовая выработка: ${annualEnergy.toFixed(2)} кВт⋅ч\n` +
        `Стоимость установки: ${totalCost.toFixed(0)} тенге\n` +
        `LCOE: ${lcoe.toFixed(2)} тенге/кВт⋅ч\n` +
        `Годовая экономия: ${(annualEnergy * ELECTRICITY_PRICE).toFixed(0)} тенге\n` +
        `Срок окупаемости: ${paybackPeriod.toFixed(1)} лет`,
        power,
        annualEnergy
    );
});

// Аналогично модифицируем обработчики для ветровой и гидроэнергетики
document.getElementById('wind-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const activeRegion = document.querySelector('.region-btn.active').dataset.region;
    const regionData = REGIONAL_DATA[activeRegion];
    const diameter = parseFloat(document.getElementById('wind-diameter').value);
    const efficiency = parseFloat(document.getElementById('wind-efficiency').value) / 100;

    if (isNaN(diameter) || isNaN(efficiency)) {
        displayResult('wind-result', "Введите корректные данные.");
        return;
    }

    const area = Math.PI * Math.pow(diameter / 2, 2);
    const power = (0.5 * 1.225 * area * Math.pow(regionData.windSpeed, 3) * efficiency) / 1000; // кВт
    const annualEnergy = calculateAnnualEnergy(power);
    const totalCost = power * ENERGY_COSTS.wind.installationCost;
    const annualOperationalCost = power * ENERGY_COSTS.wind.operationalCost;
    const paybackPeriod = calculatePayback(totalCost, annualEnergy);

    displayResult('wind-result',
        `Установленная мощность: ${power.toFixed(2)} кВт\n` +
        `Годовая выработка: ${annualEnergy.toFixed(2)} кВт⋅ч\n` +
        `Стоимость установки: ${totalCost.toFixed(0)} тенге\n` +
        `Годовая экономия: ${(annualEnergy * ELECTRICITY_PRICE).toFixed(0)} тенге\n` +
        `Срок окупаемости: ${paybackPeriod.toFixed(1)} лет`,
        power,
        annualEnergy
    );
});

document.getElementById('hydro-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const activeRegion = document.querySelector('.region-btn.active').dataset.region;
    const regionData = REGIONAL_DATA[activeRegion];
    const flow = parseFloat(document.getElementById('hydro-flow').value);
    const height = parseFloat(document.getElementById('hydro-height').value);
    const efficiency = parseFloat(document.getElementById('hydro-efficiency').value) / 100;

    if (isNaN(flow) || isNaN(height) || isNaN(efficiency)) {
        displayResult('hydro-result', "Введите корректные данные.");
        return;
    }

    const power = (9.81 * regionData.waterFlow * height * efficiency); // кВт
    const annualEnergy = calculateAnnualEnergy(power);
    const totalCost = power * ENERGY_COSTS.hydro.installationCost;
    const annualOperationalCost = power * ENERGY_COSTS.hydro.operationalCost;
    const paybackPeriod = calculatePayback(totalCost, annualEnergy);

    displayResult('hydro-result',
        `Установленная мощность: ${power.toFixed(2)} кВт\n` +
        `Годовая выработка: ${annualEnergy.toFixed(2)} кВт⋅ч\n` +
        `Стоимость установки: ${totalCost.toFixed(0)} тенге\n` +
        `Годовая экономия: ${(annualEnergy * ELECTRICITY_PRICE).toFixed(0)} тенге\n` +
        `Срок окупаемости: ${paybackPeriod.toFixed(1)} лет`,
        power,
        annualEnergy
    );
});

// Квиз
const questions = [
    {
        question: 'Какой процент территории Казахстана имеет высокий потенциал для солнечной энергетики?',
        answers: ['50%', '70%', '85%', '95%'],
        correct: 2
    },
    {
        question: 'Средняя скорость ветра, необходимая для эффективной работы ветрогенератора:',
        answers: ['2-3 м/с', '4-5 м/с', '6-7 м/с', '8-9 м/с'],
        correct: 2
    },
    {
        question: 'Какой тип возобновляемой энергии наиболее развит в Казахстане на данный момент?',
        answers: ['Солнечная', 'Ветровая', 'Гидроэнергетика', 'Геотермальная'],
        correct: 2
    },
    {
        question: 'Какой регион Казахстана имеет наибольший потенциал для развития ветроэнергетики?',
        answers: ['Алматинская область', 'Джунгарские ворота', 'Мангистауская область', 'Акмолинская область'],
        correct: 1
    },
    {
        question: 'Среднегодовая продолжительность солнечного сияния в южных регионах Казахстана составляет:',
        answers: ['1800-2000 часов', '2200-2400 часов', '2800-3000 часов', '3200-3400 часов'],
        correct: 2
    }
];

let currentQuestion = 0;
let score = 0;

function displayQuestion() {
    const question = questions[currentQuestion];
    document.getElementById('question').textContent = question.question;

    const answersContainer = document.getElementById('answers');
    answersContainer.innerHTML = '';

    question.answers.forEach((answer, index) => {
        const button = document.createElement('button');
        button.className = 'w-full p-2 text-left text-white border border-blue-400 rounded hover:bg-blue-700 transition-colors';
        button.textContent = answer;
        button.onclick = () => checkAnswer(index);
        answersContainer.appendChild(button);
    });
}

function checkAnswer(answerIndex) {
    const question = questions[currentQuestion];
    const buttons = document.querySelectorAll('#answers button');

    buttons.forEach(button => button.disabled = true);

    if (answerIndex === question.correct) {
        buttons[answerIndex].classList.add('bg-green-500');
        score++;
    } else {
        buttons[answerIndex].classList.add('bg-red-500');
        buttons[question.correct].classList.add('bg-green-500');
    }
}

document.getElementById('next-question').addEventListener('click', () => {
    currentQuestion++;
    if (currentQuestion < questions.length) {
        displayQuestion();
    } else {
        showResults();
    }
});

function showResults() {
    const container = document.getElementById('quiz-container');
    container.innerHTML = `
        <h3 class="text-2xl text-white mb-4">Тест завершен!</h3>
        <p class="text-white">Ваш результат: ${score} из ${questions.length}</p>
        <button onclick="resetQuiz()" class="mt-4 bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
            Начать заново
        </button>
    `;
}

function resetQuiz() {
    currentQuestion = 0;
    score = 0;
    displayQuestion();
}

// Инициализация квиза
displayQuestion();

// Анимация прокрутки для навигации
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Динамическая анимация для карточек калькуляторов
const observers = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
    });
}, {
    threshold: 0.1
});

document.querySelectorAll('.calculator').forEach(calculator => {
    calculator.classList.add('opacity-0', 'translate-y-10', 'transition-all', 'duration-500');
    observers.observe(calculator);
});

// Функция для отображения результата с анимацией
function displayResult(elementId, text) {
    const resultElement = document.getElementById(elementId);
    resultElement.textContent = text;
    resultElement.classList.remove('hidden');
    setTimeout(() => {
        resultElement.classList.add('visible');
    }, 10);
}

// Функция для отображения результата с поддержкой переносов строк
function displayResult(elementId, text, power = null, annualEnergy = null) {
    const resultElement = document.getElementById(elementId);
    let resultText = text;

    if (power !== null && annualEnergy !== null) {
        const solutions = findOptimalSolution(power, annualEnergy);
        if (solutions.length > 0) {
            resultText += '\n\nСравнение с другими технологиями:\n';
            solutions.forEach(sol => {
                resultText += `${sol.type.toUpperCase()}: окупаемость ${sol.payback.toFixed(1)} лет\n`;
            });
        }
    }

    resultElement.innerHTML = resultText.replace(/\n/g, '<br>');
    resultElement.classList.remove('hidden');
    setTimeout(() => {
        resultElement.classList.add('visible');
    }, 10);
}

// Добавим функцию для проверки оптимальности решения
function findOptimalSolution(power, usage) {
    const solutions = [];

    for (const type in ENERGY_COSTS) {
        if (power >= ENERGY_COSTS[type].minPower && power <= ENERGY_COSTS[type].maxPower) {
            const cost = power * ENERGY_COSTS[type].installationCost;
            const annualCost = power * ENERGY_COSTS[type].operationalCost;
            const efficiency = ENERGY_COSTS[type].efficiency;

            solutions.push({
                type: type,
                initialCost: cost,
                annualCost: annualCost,
                efficiency: efficiency,
                payback: cost / (usage * 20) // 20 тенге/кВт⋅ч - средний тариф
            });
        }
    }

    return solutions.sort((a, b) => a.payback - b.payback);
}

// Добавляем данные по регионам
const REGIONAL_DATA = {
    north: {
        name: 'Северный Казахстан',
        windSpeed: 6.5, // м/с
        waterFlow: 2.1, // м³/с
        solarRadiation: 1100, // кВт⋅ч/м²/год
        description: 'Умеренный ветер, хороший потенциал малых ГЭС'
    },
    central: {
        name: 'Центральный Казахстан',
        windSpeed: 5.8,
        waterFlow: 1.5,
        solarRadiation: 1300,
        description: 'Высокий солнечный потенциал, средний ветер'
    },
    south: {
        name: 'Южный Казахстан',
        windSpeed: 4.2,
        waterFlow: 3.2,
        solarRadiation: 1500,
        description: 'Отличный солнечный потенциал, хороший гидропотенциал'
    },
    east: {
        name: 'Восточный Казахстан',
        windSpeed: 5.2,
        waterFlow: 4.5,
        solarRadiation: 1200,
        description: 'Высокий гидропотенциал, умеренный ветер'
    },
    west: {
        name: 'Западный Казахстан',
        windSpeed: 7.2,
        waterFlow: 1.0,
        solarRadiation: 1400,
        description: 'Отличный ветровой потенциал'
    }
};

// Функция для автоматического заполнения данных при выборе региона
function updateRegionalData(region) {
    const data = REGIONAL_DATA[region];

    // Обновляем значения в формах
    if (document.getElementById('wind-speed')) {
        document.getElementById('wind-speed').value = data.windSpeed;
    }
    if (document.getElementById('hydro-flow')) {
        document.getElementById('hydro-flow').value = data.waterFlow;
    }

    // Обновляем описание региона
    const regionInfo = document.getElementById('region-info');
    if (regionInfo) {
        regionInfo.innerHTML = `
            <div class="mt-4 p-4 bg-blue-600 rounded-lg">
                <h4 class="font-bold mb-2">${data.name}</h4>
                <p>${data.description}</p>
                <ul class="mt-2">
                    <li>Средняя скорость ветра: ${data.windSpeed} м/с</li>
                    <li>Средний расход воды: ${data.waterFlow} м³/с</li>
                    <li>Солнечная радиация: ${data.solarRadiation} кВт⋅ч/м²/год</li>
                </ul>
            </div>
        `;
    }
}

// Изменяем обработчики форм для учета региональных данных
document.getElementById('solar-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const area = parseFloat(document.getElementById('solar-area').value);
    const efficiency = parseFloat(document.getElementById('solar-efficiency').value) / 100;
    const regionSelect = document.getElementById('region-select');
    const region = regionSelect.value;

    if (isNaN(area) || isNaN(efficiency)) {
        displayResult('solar-result', "Введите корректные данные.");
        return;
    }

    const solarRadiation = REGIONAL_DATA[region].solarRadiation;
    const power = area * efficiency;
    const annualEnergy = calculateAnnualEnergy(power) * (solarRadiation / 1200); // Корректировка на региональную радиацию
    // ... остальной код расчета ...
});

// Модифицируем обработчики форм для использования региональных данных
document.getElementById('wind-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const activeRegion = document.querySelector('.region-btn.active').dataset.region;
    const regionData = REGIONAL_DATA[activeRegion];
    const diameter = parseFloat(document.getElementById('wind-diameter').value);
    const efficiency = parseFloat(document.getElementById('wind-efficiency').value) / 100;

    if (isNaN(diameter) || isNaN(efficiency)) {
        displayResult('wind-result', "Введите корректные данные.");
        return;
    }

    const area = Math.PI * Math.pow(diameter / 2, 2);
    const power = (0.5 * 1.225 * area * Math.pow(regionData.windSpeed, 3) * efficiency) / 1000;
    // ...остальной код расчета...
});

document.getElementById('hydro-form').addEventListener('submit', (e) => {
    e.preventDefault();
    // Получаем активный регион и его данные
    const activeRegion = document.querySelector('.region-btn.active');
    if (!activeRegion) {
        displayResult('hydro-result', "Пожалуйста, выберите регион");
        return;
    }

    const regionData = REGIONAL_DATA[activeRegion.dataset.region];
    const height = parseFloat(document.getElementById('hydro-height').value);
    const efficiency = parseFloat(document.getElementById('hydro-efficiency').value) / 100;

    if (isNaN(height) || isNaN(efficiency)) {
        displayResult('hydro-result', "Введите корректные данные");
        return;
    }

    // Используем расход воды из данных региона
    const waterFlow = regionData.waterFlow;
    // Плотность воды (кг/м³) и ускорение свободного падения (м/с²)
    const waterDensity = 1000;
    const gravity = 9.81;

    // Расчет мощности в кВт
    const power = (waterDensity * gravity * waterFlow * height * efficiency) / 1000;
    const annualEnergy = calculateAnnualEnergy(power);
    const totalCost = power * ENERGY_COSTS.hydro.installationCost;
    const annualOperationalCost = power * ENERGY_COSTS.hydro.operationalCost;
    const paybackPeriod = calculatePayback(totalCost, annualEnergy);

    displayResult('hydro-result',
        `Установленная мощность: ${power.toFixed(2)} кВт\n` +
        `Годовая выработка: ${annualEnergy.toFixed(2)} кВт⋅ч\n` +
        `Расход воды в регионе: ${waterFlow} м³/с\n` +
        `Стоимость установки: ${totalCost.toFixed(0)} тенге\n` +
        `Годовая экономия: ${(annualEnergy * ELECTRICITY_PRICE).toFixed(0)} тенге\n` +
        `Срок окупаемости: ${paybackPeriod.toFixed(1)} лет`,
        power,
        annualEnergy
    );
});

// Функция выбора региона
function selectRegion(region) {
    // Убираем активный класс со всех кнопок
    document.querySelectorAll('.region-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Добавляем активный класс выбранной кнопке
    document.querySelector(`[data-region="${region}"]`).classList.add('active');

    // Получаем данные региона
    const data = REGIONAL_DATA[region];

    // Обновляем значения в формах
    if (document.getElementById('wind-speed')) {
        document.getElementById('wind-speed').value = data.windSpeed;
    }
    if (document.getElementById('hydro-flow')) {
        document.getElementById('hydro-flow').value = data.waterFlow;
    }

    // Показываем информацию о регионе
    const regionInfo = document.getElementById('region-info');
    regionInfo.innerHTML = `
        <h4 class="text-xl font-bold text-white mb-2">${data.name}</h4>
        <p class="text-gray-200 mb-3">${data.description}</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
            <div class="flex items-center gap-2">
                <i class="fas fa-wind text-xl"></i>
                <span>Ветер: ${data.windSpeed} м/с</span>
            </div>
            <div class="flex items-center gap-2">
                <i class="fas fa-water text-xl"></i>
                <span>Расход воды: ${data.waterFlow} м/с</span>
            </div>
            <div class="flex items-center gap-2">
                <i class="fas fa-sun text-xl"></i>
                <span>Радиация: ${data.solarRadiation} кВт⋅ч/м²/год</span>
            </div>
        </div>
    `;
    regionInfo.classList.remove('hidden');
}

// Устанавливаем начальный регион
document.addEventListener('DOMContentLoaded', () => {
    selectRegion('central');
});
