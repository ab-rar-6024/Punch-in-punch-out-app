// screens/AdminScreen.js
import { useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import axios from '../api';

export default function AdminScreen({ navigation }) {
  const [pin, setPin] = useState('');
  const [adminVerified, setAdminVerified] = useState(false);
  const [records, setRecords] = useState([]);

  const verifyAdminPin = async () => {
    try {
      const response = await axios.post('/admin_login', { pin });
      if (response.data.success) {
        setAdminVerified(true);
        fetchAttendance();
      } else {
        Alert.alert('Login Failed', response.data.message);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server.');
    }
  };

  const fetchAttendance = async () => {
    try {
      const res = await axios.get('/admin/latest_attendance');
      setRecords(res.data.records || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch attendance.');
    }
  };

  if (!adminVerified) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Admin Quick PIN</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          maxLength={4}
          placeholder="Enter Admin PIN"
          value={pin}
          onChangeText={setPin}
        />
        <Button title="Login" onPress={verifyAdminPin} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Today's Attendance</Text>
      <FlatList
        data={records}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name} ({item.emp_code})</Text>
            <Text>Time In: {item.time_in || '—'}</Text>
            <Text>Time Out: {item.time_out || '—'}</Text>
            <Text>Location: {item.location || '—'}</Text>
            <Text>Absent: {item.absent === 'Yes' ? 'Yes' : 'No'}</Text>
            {item.absent === 'Yes' && <Text>Reason: {item.reason}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 12,
    borderRadius: 4, fontSize: 16,
  },
  card: {
    padding: 12, backgroundColor: '#f8f8f8',
    borderRadius: 8, marginBottom: 10,
  },
  name: { fontWeight: 'bold', marginBottom: 4 },
});

