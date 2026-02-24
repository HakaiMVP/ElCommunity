import React from 'react';

import HomeFeed from '../components/HomeFeed';

const Home = () => {
    return (
        <div className="p-6 text-white animate-fade-in">
            <h1 className="text-3xl font-bold mb-4">Início - Feed da Comunidade</h1>
            <p className="text-gray-400 mb-8">Fique por dentro das últimas novidades de Elios e das suas guildas.</p>
            <HomeFeed />
        </div>
    );
};

export default Home;
