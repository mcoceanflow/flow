import { View, Text, Button } from 'react-native';
import React from 'react';

const List = ({ navigation }: any) => {
    return (
        <View>
            <Text>List Screen</Text>
            <Button onPress={() => navigation.navigate('Details')} title="Open Details" />
        </View>
    );
};

export default List;